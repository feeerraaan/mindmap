/**
 * Analytics — typed event tracking.
 *
 * Phase 1 ships the no-op implementation; phase 8 swaps in PostHog or
 * Segment behind the same interface. Calls are fire-and-forget and never
 * block the caller.
 */

export type EventName =
  | 'auth.signed_in'
  | 'auth.signed_out'
  | 'onboarding.completed'
  | 'workspace.created'
  | 'document.uploaded'
  | 'document.parsed'
  | 'document.graph_built'
  | 'document.diagnosed'
  | 'coupon.redeemed'
  | 'error.brain'

export interface EventPayload {
  [key: string]: string | number | boolean | null | undefined
}

export interface AnalyticsClient {
  track(event: EventName, payload?: EventPayload): void
  identify(userId: string, traits?: EventPayload): void
  reset(): void
}

class NoopAnalytics implements AnalyticsClient {
  track(_event: EventName, _payload?: EventPayload): void {
    /* noop */
  }
  identify(_userId: string, _traits?: EventPayload): void {
    /* noop */
  }
  reset(): void {
    /* noop */
  }
}

export const analytics: AnalyticsClient = new NoopAnalytics()
