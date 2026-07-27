/**
 * Timeline engine — phase 6.
 *
 *   Pure math. No LLM calls. The engine takes a snapshot of a user's
 *   `ConceptState`s (one per concept in a document) and produces a
 *   `ReviewPlan`: a set of `ReviewSession`s, each scheduled for a given
 *   day, with up to MAX_ITEMS_PER_DAY items prioritised by
 *   `importance * (1 - mastery)`.
 *
 *   The schedule is *adaptive*: a concept's next-due is a function of
 *   its current `(mastery, confidence)`, the magnitude of its last
 *   delta, and how hard the concept is. After every review the caller
 *   re-runs `scheduleReviews` to refresh the plan — the brain's
 *   "forgetting curve" is a property of the live state, not a fixed
 *   SM-2 card.
 *
 *   Math reference: `docs/brain.md` §8.
 */
import type { ConceptState, ReviewItem, ReviewPlan, ReviewSession } from '@mindmap/types'

export const MAX_ITEMS_PER_DAY = 10
export const DEFAULT_HORIZON_DAYS = 7
export const PRO_HORIZON_DAYS = 90

export interface TimelineConceptInput {
  conceptId: string
  title: string
  chapter: string | null
  topic: string | null
  importance: number
  difficulty: number
  state: Pick<
    ConceptState,
    'mastery' | 'confidence' | 'lastDelta' | 'lastSeen' | 'dueAt' | 'attempts'
  > | null
}

export interface ScheduleInput {
  documentId: string
  plan?: 'FREE' | 'PRO'
  /** Today's anchor (defaults to `new Date()`). Tests can pin this. */
  now?: Date
  /** Cap the visible horizon. */
  horizonDays?: number
  /** Optional exam date used to compress intervals and cap the horizon. */
  examDate?: Date
  concepts: TimelineConceptInput[]
}

export interface ScheduleOutput {
  planId: string | null
  sessions: ReviewSession[]
  items: ReviewItem[]
  /** Diagnostics, useful for the UI / tests. */
  diagnostics: {
    totalConcepts: number
    scheduledConcepts: number
    droppedConcepts: number
    horizonDays: number
  }
}

export type ReviewReason = 'decay' | 'new-weakness' | 'dependency-gap' | 'first-review' | 'priority'

/**
 * Per-concept interval (in days) until the next review.
 *
 *   baseInterval
 *     * (1 + mastery)              // known concepts space out
 *     * (0.5 + confidence)         // uncertain concepts come back sooner
 *     * (1 + abs(lastDelta))       // recent big change → revisit soon
 *     * difficultyPenalty          // hard concepts shrink intervals
 *
 *   baseInterval starts at 1 day; the caller doubles on success and
 *   halves on failure (no punitive doubling — the intervals soften).
 */
export function intervalDays(input: {
  mastery: number
  confidence: number
  lastDelta: number | null
  difficulty: number
  /** Streak of successful past reviews; doubles the interval each time. */
  streak?: number
  /** Anchor used to compute distance to the exam. */
  now?: Date
  /** Optional exam date used to compress intervals so reviews fit before it. */
  examDate?: Date
}): number {
  const mastery = clamp01(input.mastery)
  const confidence = clamp01(input.confidence)
  const lastDelta = input.lastDelta === null ? 0 : Math.abs(input.lastDelta)
  const difficulty = clamp01(input.difficulty)
  const streak = Math.max(0, input.streak ?? 0)

  // Difficulty penalty: 1.0 for trivial concepts, 0.5 for the hardest.
  const difficultyPenalty = 1 - 0.5 * difficulty

  // Base of 2 days (instead of the textbook 1) so the multipliers
  // produce a useful spread — 2..15 days for the typical case.
  const base = 2
  const raw = base * (1 + mastery) * (0.5 + confidence) * (1 + lastDelta) * difficultyPenalty
  // Streak doubles the interval (capped at 2^5 = 32x).
  let days = Math.max(1, Math.round(raw * Math.pow(2, Math.min(5, streak))))

  // Compress intervals when an exam date is set so repetitions fit
  // inside the remaining time without stretching past it.
  if (input.examDate && input.now) {
    const msPerDay = 24 * 60 * 60 * 1000
    const daysUntilExam = Math.max(
      1,
      Math.floor((input.examDate.getTime() - input.now.getTime()) / msPerDay),
    )
    const factor = daysUntilExam / (days + daysUntilExam)
    days = Math.max(1, Math.round(days * factor))
  }

  return days
}

/**
 * Priority for ranking items *within* a single day. Higher = more urgent.
 * Combines importance, current weakness, and reason-specific bumps.
 */
export function priorityFor(input: {
  importance: number
  mastery: number
  confidence: number
  reason: ReviewReason
}): number {
  const base = input.importance * (1 - input.mastery) * (0.5 + input.confidence)
  const reasonBump: Record<ReviewReason, number> = {
    decay: 1.4,
    'new-weakness': 1.3,
    'dependency-gap': 1.2,
    'first-review': 1.1,
    priority: 1.0,
  }
  return base * (reasonBump[input.reason] ?? 1.0)
}

export function reasonFor(input: {
  mastery: number
  confidence: number
  lastDelta: number | null
  attempts: number
}): ReviewReason {
  if (input.attempts === 0) return 'first-review'
  if (input.lastDelta !== null && input.lastDelta < -0.1) return 'new-weakness'
  if (input.confidence < 0.3) return 'decay'
  if (input.mastery < 0.5) return 'priority'
  return 'priority'
}

/**
 * Build (or rebuild) a `ReviewPlan` for a document.
 *
 *   Pure: returns a serialisable shape. The caller writes to the DB.
 *   Idempotent: calling twice with the same state produces the same
 *   schedule (modulo `now`).
 */
export function scheduleReviews(input: ScheduleInput): ScheduleOutput {
  const now = input.now ?? new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const horizonDays =
    input.horizonDays ?? (input.plan === 'PRO' ? PRO_HORIZON_DAYS : DEFAULT_HORIZON_DAYS)
  const defaultHorizonEnd = new Date(now.getTime() + horizonDays * msPerDay)
  const horizonEnd =
    input.examDate && input.examDate.getTime() < defaultHorizonEnd.getTime()
      ? input.examDate
      : defaultHorizonEnd

  // Bucket: dayKey (YYYY-MM-DD) → candidate items
  type Candidate = {
    conceptId: string
    title: string
    chapter: string | null
    topic: string | null
    importance: number
    mastery: number
    confidence: number
    reason: ReviewReason
    priority: number
    dueAt: Date
  }
  const buckets = new Map<string, Candidate[]>()

  let scheduledConcepts = 0
  let droppedConcepts = 0

  for (const c of input.concepts) {
    const s = c.state
    const mastery = s?.mastery ?? 0.1
    const confidence = s?.confidence ?? 0
    const lastDelta = s?.lastDelta ?? null
    const attempts = s?.attempts ?? 0

    // Compute the desired interval.
    const days = intervalDays({
      mastery,
      confidence,
      lastDelta,
      difficulty: c.difficulty,
      now,
      examDate: input.examDate,
    })

    // First review of an unknown concept is due "today" (so the
    // diagnosis loop visits it). Otherwise the due date is `days` from
    // the last seen date (or `now` if never seen).
    let dueAt: Date
    if (s?.dueAt) {
      dueAt = new Date(s.dueAt)
    } else if (s?.lastSeen) {
      dueAt = new Date(s.lastSeen.getTime() + days * 24 * 60 * 60 * 1000)
    } else if (attempts === 0) {
      // Never-probed concepts show up in today's queue.
      dueAt = now
    } else {
      dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    }

    // If the due date is past the horizon, skip — the plan is
    // forward-looking, and stale items would just bloat today's queue.
    if (dueAt.getTime() > horizonEnd.getTime()) {
      droppedConcepts += 1
      continue
    }
    // If mastery is rock-solid and confidence is high, do not schedule
    // again inside the horizon (the caller may still ask to refresh,
    // but the engine refuses to over-burden the user).
    if (mastery >= 0.95 && confidence >= 0.9 && attempts > 0 && (lastDelta ?? 0) >= 0) {
      droppedConcepts += 1
      continue
    }

    const reason = reasonFor({ mastery, confidence, lastDelta, attempts })
    const priority = priorityFor({ importance: c.importance, mastery, confidence, reason })

    const bucketKey = dayKey(dueAt)
    const list = buckets.get(bucketKey) ?? []
    if (list.length < MAX_ITEMS_PER_DAY) {
      list.push({
        conceptId: c.conceptId,
        title: c.title,
        chapter: c.chapter,
        topic: c.topic,
        importance: c.importance,
        mastery,
        confidence,
        reason,
        priority,
        dueAt,
      })
      buckets.set(bucketKey, list)
      scheduledConcepts += 1
    } else {
      // The day's bucket is full. Try to slot in by replacing the
      // lowest-priority item (so the most urgent work wins).
      const lowest = list.reduce<{ idx: number; p: number }>(
        (acc, item, idx) => {
          if (item.priority < acc.p) return { idx, p: item.priority }
          return acc
        },
        { idx: -1, p: Infinity },
      )
      if (lowest.idx >= 0 && priority > lowest.p) {
        list[lowest.idx] = {
          conceptId: c.conceptId,
          title: c.title,
          chapter: c.chapter,
          topic: c.topic,
          importance: c.importance,
          mastery,
          confidence,
          reason,
          priority,
          dueAt,
        }
        scheduledConcepts += 1
      } else {
        droppedConcepts += 1
      }
    }
  }

  // Build sessions in chronological order.
  const sessions: ReviewSession[] = []
  const items: ReviewItem[] = []
  const sortedKeys = Array.from(buckets.keys()).sort()
  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!
    // Sort the bucket by priority desc.
    bucket.sort((a, b) => b.priority - a.priority)
    const scheduledFor = parseDayKey(key, now)
    const session: ReviewSession = {
      id: `rs_${input.documentId}_${key}`,
      planId: '',
      userId: '',
      scheduledFor,
      startedAt: null,
      completedAt: null,
      status: 'SCHEDULED',
    }
    sessions.push(session)
    for (let i = 0; i < bucket.length; i += 1) {
      const cand = bucket[i]!
      items.push({
        id: `ri_${input.documentId}_${key}_${i}`,
        sessionId: session.id,
        conceptId: cand.conceptId,
        priority: cand.priority,
        reason: cand.reason,
      })
    }
  }

  const output: ScheduleOutput = {
    planId: null,
    sessions,
    items,
    diagnostics: {
      totalConcepts: input.concepts.length,
      scheduledConcepts,
      droppedConcepts,
      horizonDays,
    },
  }
  return output
}

/**
 * The reason a session is being shown in the "Today" tray.
 * A `DUE` session is one whose scheduledFor is today (UTC-day) and
 * the user has not started it.
 */
export function isDueToday(session: ReviewSession, now: Date = new Date()): boolean {
  return dayKey(session.scheduledFor) === dayKey(now) && session.status === 'SCHEDULED'
}

export function isOverdue(session: ReviewSession, now: Date = new Date()): boolean {
  return session.scheduledFor.getTime() < now.getTime() && session.status === 'SCHEDULED'
}

export function dayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDayKey(key: string, anchor: Date): Date {
  // We honour the *clock-time* of the anchor and the day-of-month in
  // `key`, so the due time matches the user's local-feeling schedule
  // (the plan store will convert to UTC; this is the writer's call).
  const [y, m, d] = key.split('-').map((s) => Number(s))
  const out = new Date(anchor)
  out.setUTCFullYear(y!, m! - 1, d!)
  out.setUTCHours(9, 0, 0, 0)
  return out
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Convenience: format a date as a short human label, e.g. "Today",
 * "Tomorrow", "Mon". Pure.
 */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const a = dayKey(d)
  const n = dayKey(now)
  const tomorrowKey = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  if (a === n) return 'today'
  if (a === tomorrowKey) return 'tomorrow'
  return d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
}

void ({} as ReviewPlan)
