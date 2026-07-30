/**
 * Provider adapter - the only abstraction the rest of the brain sees.
 *
 * Each provider implements `chat`, returning a normalized result. Engines
 * never see OpenAI shapes; they see `{ text, tokensIn, tokensOut }`.
 *
 * Provider implementations live in `./zen.ts` and `./go.ts`. The mock in
 * `./mock.ts` is used by tests and the in-process fallback path.
 */
import type { ProviderId } from '@mindmap/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  system?: string
  user: string
  model: string
  maxTokens?: number
  temperature?: number
  /** Override the JSON-mode hint sent to the provider. Default true. */
  jsonMode?: boolean
  /** Per-request timeout in ms. Default 30 000. */
  timeoutMs?: number
}

export interface ChatResponse {
  text: string
  tokensIn: number
  tokensOut: number
  model: string
  provider: ProviderId
}

export class ProviderError extends Error {
  readonly provider: ProviderId
  constructor(provider: ProviderId, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
  }
}

export class ProviderRateLimited extends Error {
  readonly provider: ProviderId
  readonly retryAfterMs: number
  constructor(provider: ProviderId, retryAfterMs: number) {
    super(`Provider ${provider} rate-limited (retry after ${retryAfterMs}ms)`)
    this.name = 'ProviderRateLimited'
    this.provider = provider
    this.retryAfterMs = retryAfterMs
  }
}

export class ProviderMissingKey extends Error {
  readonly provider: ProviderId
  constructor(provider: ProviderId) {
    super(
      `Provider ${provider} has no API key configured (set OPENCODE_${provider.toUpperCase()}_KEY).`,
    )
    this.name = 'ProviderMissingKey'
    this.provider = provider
  }
}

export interface ProviderAdapter {
  readonly id: ProviderId
  /** Lightweight availability check. Used by the router before dispatch. */
  isAvailable(): boolean
  chat(req: ChatRequest): Promise<ChatResponse>
}
