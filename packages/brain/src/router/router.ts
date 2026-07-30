/**
 * Router - picks a (provider, model) for a given task + user, respects the
 * token bucket and the daily budget. On a hard provider error, falls through
 * to the next candidate so a misconfigured primary endpoint does not block work.
 */
import type { ProviderId, TaskType } from '@mindmap/types'
import { Err, type Result } from '@mindmap/shared'
import type { BrainError } from '../errors'
import type { ChatRequest, ChatResponse, ProviderAdapter } from '../providers/provider'
import { ProviderRateLimited } from '../providers/provider'
import { getProvider, listProviders } from '../providers/registry'
import { candidatesFor, type Candidate } from './policy'
import { recordUsage } from './budget'
import { tryConsume } from './token-bucket'

export interface RouteContext {
  userId: string
  task: TaskType
}

export interface RouteDecision {
  provider: ProviderId
  model: string
  temperature?: number
  maxTokens?: number
}

function firstAvailable(
  candidates: Candidate[],
): { candidate: Candidate; provider: ProviderAdapter } | null {
  for (const c of candidates) {
    const p = getProvider(c.provider)
    if (!p.isAvailable()) continue
    return { candidate: c, provider: p }
  }
  return null
}

/**
 * Pick a candidate without consuming the token bucket. Call `commit` after
 * a successful call to deduct the cost.
 */
export function pickRoute(ctx: RouteContext): Result<RouteDecision, BrainError> {
  const candidates = candidatesFor(ctx.task)
  const found = firstAvailable(candidates)
  if (!found) return Err({ kind: 'BudgetExceeded', userId: ctx.userId })
  return Ok({
    provider: found.candidate.provider,
    model: found.candidate.model,
    ...(found.candidate.temperature !== undefined
      ? { temperature: found.candidate.temperature }
      : {}),
    ...(found.candidate.maxTokens !== undefined ? { maxTokens: found.candidate.maxTokens } : {}),
  })
}

/** Record tokens after a successful call. */
export function recordCallTokens(
  ctx: RouteContext,
  decision: RouteDecision,
  r: ChatResponse,
): void {
  recordUsage(ctx.userId, r.tokensIn, r.tokensOut)
  // restore one bucket token we optimistically consumed in pickRoute
  // (so retries within the same task still have headroom)
  tryConsume(decision.provider, ctx.userId, -1)
}

/**
 * Mark a (provider, model) pair as broken so subsequent calls skip
 * it. Used by the engine to fall through to the next candidate when
 * the primary endpoint is misconfigured or out of balance.
 */
const badCandidates = new Set<string>()

function keyOf(provider: ProviderId, model: string): string {
  return `${provider}::${model}`
}

export function markProviderBad(provider: ProviderId, model: string): void {
  badCandidates.add(keyOf(provider, model))
}

export function isCandidateBad(provider: ProviderId, model: string): boolean {
  return badCandidates.has(keyOf(provider, model))
}

/** Backwards-compat: a whole provider is treated as bad when the
 *  caller doesn't know the model. We mark every model we know about
 *  for that provider. */
export function isProviderBad(provider: ProviderId): boolean {
  // For each candidate slot that uses this provider, see if all models
  // are bad. (We don't keep a full reverse index - so this is only
  // cheap for the common case where one model is bad.)
  for (const key of badCandidates) {
    if (key.startsWith(`${provider}::`)) return true
  }
  return false
}

export function resetBadProviders(): void {
  badCandidates.clear()
}

/**
 * Like `pickRoute` but walks every candidate and skips the ones that
 * have been marked bad. Returns the first non-bad available
 * candidate, or `BudgetExceeded`.
 */
export function pickRouteResilient(ctx: RouteContext): Result<RouteDecision, BrainError> {
  const picked = pickRouteWithProvider(ctx)
  if (!picked.ok) return picked
  return Ok(picked.value.decision)
}

/** Like `pickRouteResilient` but also returns the provider adapter, so
 *  callers (like the engine's `withSchemaRepair` loop) can use it
 *  directly. */
export function pickRouteWithProvider(
  ctx: RouteContext,
): Result<{ decision: RouteDecision; provider: ProviderAdapter }, BrainError> {
  const candidates = candidatesFor(ctx.task)
  for (const c of candidates) {
    if (isCandidateBad(c.provider, c.model)) continue
    const provider = getProvider(c.provider)
    if (!provider.isAvailable()) continue
    return Ok({
      decision: {
        provider: c.provider,
        model: c.model,
        ...(c.temperature !== undefined ? { temperature: c.temperature } : {}),
        ...(c.maxTokens !== undefined ? { maxTokens: c.maxTokens } : {}),
      },
      provider,
    })
  }
  return Err({ kind: 'BudgetExceeded', userId: ctx.userId })
}

/** Top-level helper: pick + call. The retry / schema-repair loop sits above. */
export async function dispatch(
  ctx: RouteContext,
  build: (decision: RouteDecision) => ChatRequest,
): Promise<Result<{ decision: RouteDecision; response: ChatResponse }, BrainError>> {
  // Walk the candidate list, restoring the bucket between attempts so
  // a hard failure on the first provider does not consume capacity.
  let lastError: BrainError | null = null
  const candidates = candidatesFor(ctx.task)
  for (const c of candidates) {
    const provider = getProvider(c.provider)
    if (!provider.isAvailable()) continue
    const decision: RouteDecision = {
      provider: c.provider,
      model: c.model,
      ...(c.temperature !== undefined ? { temperature: c.temperature } : {}),
      ...(c.maxTokens !== undefined ? { maxTokens: c.maxTokens } : {}),
    }
    try {
      const response = await callWithRateLimitRetry(provider, build(decision))
      return Ok({ decision, response })
    } catch (e) {
      lastError = {
        kind: 'ProviderError',
        provider: c.provider,
        message: e instanceof Error ? e.message : String(e),
      }
      continue
    }
  }
  if (lastError) return Err(lastError)
  return Err({ kind: 'BudgetExceeded', userId: ctx.userId })
}

const DISPATCH_RATE_LIMIT_RETRIES = 3

async function callWithRateLimitRetry(
  provider: ProviderAdapter,
  req: ChatRequest,
): Promise<ChatResponse> {
  for (let i = 0; i <= DISPATCH_RATE_LIMIT_RETRIES; i += 1) {
    try {
      return await provider.chat(req)
    } catch (e) {
      if (e instanceof ProviderRateLimited && i < DISPATCH_RATE_LIMIT_RETRIES) {
        await new Promise((r) => setTimeout(r, e.retryAfterMs))
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

/** For tests / introspection. */
export function availableProviderCount(): number {
  return listProviders().filter((p) => p.isAvailable()).length
}

function Ok<T>(v: T): Result<T, never> {
  return { ok: true, value: v }
}
