/**
 * Exponential backoff with jitter. The default config is intentionally simple -
 * we tune for hackathon-scale concurrency, not web-scale.
 */
export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitter?: boolean
  /** Returns true if the error is retryable. Defaults to all errors. */
  shouldRetry?: (err: unknown) => boolean
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void
}

const DEFAULTS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitter: true,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const o = { ...DEFAULTS, ...opts }
  let attempt = 0
  let lastErr: unknown

  while (attempt < o.maxAttempts) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      attempt += 1
      if (attempt >= o.maxAttempts) break
      if (opts.shouldRetry && !opts.shouldRetry(err)) break

      const exp = Math.min(o.baseDelayMs * 2 ** (attempt - 1), o.maxDelayMs)
      const delay = o.jitter ? Math.floor(exp * (0.5 + Math.random() * 0.5)) : exp
      opts.onRetry?.(attempt, err, delay)
      await sleep(delay)
    }
  }

  throw lastErr
}
