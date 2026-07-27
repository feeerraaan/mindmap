/**
 * Retry helpers. Two layers:
 *
 *  1. `withBackoff(fn)` — generic exponential backoff with jitter, used for
 *     transient provider errors.
 *  2. `withSchemaRepair({ call, schema, task, maxRetries })` — runs an LLM
 *     call, validates the JSON output against a Zod schema, and on
 *     validation failure retries with a corrective message. Up to 2
 *     retries, then returns a `SchemaFailure` BrainError.
 */
import type { z } from 'zod'
import { Err, type Result } from '@mindmap/shared'
import type { BrainError, TaskType } from '@mindmap/types'
import { extractJson } from './schemas/knowledge'
import type { ChatRequest, ChatResponse, ProviderAdapter } from './providers/provider'
import { ProviderRateLimited } from './providers/provider'

export interface BackoffOptions {
  maxAttempts: number
  baseMs: number
  maxMs: number
}

const DEFAULT_BACKOFF: BackoffOptions = { maxAttempts: 3, baseMs: 400, maxMs: 5_000 }

export async function withBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  opts: Partial<BackoffOptions> = {},
): Promise<T> {
  const o: BackoffOptions = { ...DEFAULT_BACKOFF, ...opts }
  let lastErr: unknown
  for (let i = 0; i < o.maxAttempts; i += 1) {
    try {
      return await fn(i)
    } catch (e) {
      lastErr = e
      if (i === o.maxAttempts - 1) break
      const wait = Math.min(o.maxMs, o.baseMs * 2 ** i) + Math.floor(Math.random() * 200)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

export interface SchemaRepairOptions<S extends z.ZodTypeAny> {
  provider: ProviderAdapter
  buildRequest: (previous: { raw: string; error: string } | null) => ChatRequest
  schema: S
  task: TaskType
  maxRetries?: number
}

export interface SchemaRepairResult<S extends z.ZodTypeAny> {
  value: z.infer<S>
  raw: string
  attempts: number
  tokensIn: number
  tokensOut: number
  providerId: ChatResponse['provider']
  model: string
}

const MAX_RATE_LIMIT_RETRIES = 3

export async function withSchemaRepair<S extends z.ZodTypeAny>(
  opts: SchemaRepairOptions<S>,
): Promise<Result<SchemaRepairResult<S>, BrainError>> {
  const maxRetries = opts.maxRetries ?? 2
  const build = opts.buildRequest
  let last: { raw: string; error: string } | null = null
  let totalIn = 0
  let totalOut = 0
  let lastResponse: ChatResponse | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const req = build(last)
    let res: ChatResponse
    try {
      res = await callWithRateLimitRetry(opts.provider, req)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return Err({ kind: 'ProviderError', provider: opts.provider.id, message })
    }
    totalIn += res.tokensIn
    totalOut += res.tokensOut
    lastResponse = res
    let parsed: unknown
    try {
      parsed = extractJson(res.text)
    } catch (e) {
      last = { raw: res.text, error: e instanceof Error ? e.message : 'parse error' }
      continue
    }
    const validated = opts.schema.safeParse(parsed)
    if (validated.success) {
      return Ok({
        value: validated.data,
        raw: res.text,
        attempts: attempt + 1,
        tokensIn: totalIn,
        tokensOut: totalOut,
        providerId: res.provider,
        model: res.model,
      })
    }
    last = { raw: res.text, error: validated.error.message }
  }
  void lastResponse
  return Err({
    kind: 'SchemaFailure',
    task: opts.task,
    message: last?.error ?? 'unknown schema failure',
  })
}

async function callWithRateLimitRetry(
  provider: ProviderAdapter,
  req: ChatRequest,
): Promise<ChatResponse> {
  for (let i = 0; i <= MAX_RATE_LIMIT_RETRIES; i += 1) {
    try {
      return await provider.chat(req)
    } catch (e) {
      if (e instanceof ProviderRateLimited && i < MAX_RATE_LIMIT_RETRIES) {
        await new Promise((r) => setTimeout(r, e.retryAfterMs))
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

function Ok<T>(v: T): Result<T, never> {
  return { ok: true, value: v }
}
