/**
 * Token bucket — simple, in-memory, per (provider, user). Capacity is the
 * burst; refill is steady. Used by the router to avoid hammering a provider
 * past a sane per-user rate.
 *
 * Production note: in MVP this lives in the Node process, so it is per-Vercel
 * instance, not global. That is good enough for the hackathon — the global
 * ceiling is enforced by the provider's own quota. In phase 8 we can swap
 * in Upstash without touching call sites.
 */
import type { ProviderId } from '@mindmap/types'

export interface TokenBucketOptions {
  capacity: number
  refillPerMinute: number
}

const DEFAULTS: Record<ProviderId, TokenBucketOptions> = {
  zen: { capacity: 60, refillPerMinute: 60 },
  go: { capacity: 20, refillPerMinute: 20 },
}

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

function key(provider: ProviderId, userId: string): string {
  return `${provider}:${userId}`
}

function getOrCreate(provider: ProviderId, userId: string, opts: TokenBucketOptions): Bucket {
  const k = key(provider, userId)
  let b = buckets.get(k)
  if (!b) {
    b = { tokens: opts.capacity, lastRefill: Date.now() }
    buckets.set(k, b)
  }
  return b
}

function refill(b: Bucket, opts: TokenBucketOptions): void {
  const now = Date.now()
  const elapsedMin = (now - b.lastRefill) / 60_000
  if (elapsedMin <= 0) return
  const added = elapsedMin * opts.refillPerMinute
  b.tokens = Math.min(opts.capacity, b.tokens + added)
  b.lastRefill = now
}

export function tryConsume(
  provider: ProviderId,
  userId: string,
  cost = 1,
  opts?: Partial<TokenBucketOptions>,
): boolean {
  const merged: TokenBucketOptions = { ...DEFAULTS[provider], ...opts }
  const b = getOrCreate(provider, userId, merged)
  refill(b, merged)
  if (b.tokens >= cost) {
    b.tokens -= cost
    return true
  }
  return false
}

export function resetBucket(provider?: ProviderId, userId?: string): void {
  if (!provider) {
    buckets.clear()
    return
  }
  if (!userId) {
    for (const k of buckets.keys()) if (k.startsWith(`${provider}:`)) buckets.delete(k)
    return
  }
  buckets.delete(key(provider, userId))
}
