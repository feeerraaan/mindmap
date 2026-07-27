/**
 * Brain error helpers. The canonical `BrainError` union lives in @mindmap/types
 * so callers can validate it; this module re-exports plus a few guards and
 * a string-formatter for the API boundary.
 */
import type { BrainError, ProviderId, TaskType } from '@mindmap/types'

export type { BrainError }

export function isBudgetExceeded(
  e: BrainError,
): e is Extract<BrainError, { kind: 'BudgetExceeded' }> {
  return e.kind === 'BudgetExceeded'
}

export function isSchemaFailure(
  e: BrainError,
): e is Extract<BrainError, { kind: 'SchemaFailure'; task: TaskType }> {
  return e.kind === 'SchemaFailure'
}

export function isRateLimited(
  e: BrainError,
): e is Extract<BrainError, { kind: 'RateLimited'; provider: ProviderId }> {
  return e.kind === 'RateLimited'
}

/** Render a BrainError as a short human-readable string. The API routes
 *  use this to send back a meaningful message; the UI then maps the
 *  kind to a calm copy. */
export function describeError(e: BrainError): string {
  switch (e.kind) {
    case 'RateLimited':
      return `Provider ${e.provider} is rate-limited. Try again in ${Math.round(e.retryAfterMs / 1000)}s.`
    case 'SchemaFailure':
      return `The model returned an unexpected response (task=${e.task}). ${e.message}`
    case 'ProviderError':
      return `Provider ${e.provider} failed: ${e.message}`
    case 'BudgetExceeded':
      return 'Your Mind is resting for today. Try again tomorrow.'
    case 'InvalidInput':
      return e.message
  }
}
