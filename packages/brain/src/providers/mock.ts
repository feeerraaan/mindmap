/**
 * Mock provider used by tests and the demo "no keys" path. Lets a test
 * register a queue of canned responses that are returned in order.
 *
 * Each script entry is consumed on the first call that matches it, so a
 * retry on the same task will see the next entry. This mirrors the real
 * provider's behaviour: every call sees a new response.
 */
import type { ProviderId } from '@mindmap/types'
import type { ChatRequest, ChatResponse, ProviderAdapter } from './provider'

export interface MockScript {
  /** Match the request prompt by substring or regex. */
  match: string | RegExp
  text: string
  tokensIn?: number
  tokensOut?: number
  /** When set, the entry is reused for every matching call. Default: consumed on first use. */
  sticky?: boolean
}

export interface MockProviderOptions {
  id?: ProviderId
  available?: boolean
  script?: MockScript[]
  defaultText?: string
  /** When set, match a script entry by its index in the order. Bypasses the matching logic. */
  callCount?: number
}

export function mockProvider(opts: MockProviderOptions = {}): ProviderAdapter {
  const id = opts.id ?? 'zen'
  const available = opts.available ?? true
  const defaultText = opts.defaultText ?? '{}'
  const consumed = new Set<number>()
  return {
    id,
    isAvailable: () => available,
    async chat(req: ChatRequest): Promise<ChatResponse> {
      const script = opts.script ?? []
      let hitIdx = -1
      for (let i = 0; i < script.length; i += 1) {
        if (consumed.has(i)) continue
        const s = script[i]!
        const matches =
          typeof s.match === 'string' ? req.user.includes(s.match) : s.match.test(req.user)
        if (matches) {
          hitIdx = i
          if (!s.sticky) consumed.add(i)
          break
        }
      }
      const hit = hitIdx >= 0 ? script[hitIdx] : null
      const text = hit?.text ?? defaultText
      return {
        text,
        tokensIn: hit?.tokensIn ?? Math.max(50, Math.floor(req.user.length / 4)),
        tokensOut: hit?.tokensOut ?? Math.max(20, Math.floor(text.length / 4)),
        model: req.model || 'mock',
        provider: id,
      }
    },
  }
}

export function _callCountOf(p: ProviderAdapter): number {
  return (p as unknown as { _calls?: number })._calls ?? 0
}
