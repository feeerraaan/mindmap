import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_HORIZON_DAYS,
  MAX_ITEMS_PER_DAY,
  dayKey,
  dayLabel,
  intervalDays,
  isDueToday,
  isOverdue,
  priorityFor,
  reasonFor,
  scheduleReviews,
  type TimelineConceptInput,
} from './timeline-engine'

function makeConcept(overrides: Partial<TimelineConceptInput> = {}): TimelineConceptInput {
  return {
    conceptId: overrides.conceptId ?? 'c-1',
    title: overrides.title ?? 'Concept 1',
    chapter: overrides.chapter ?? 'Ch 1',
    topic: overrides.topic ?? 'T 1',
    importance: overrides.importance ?? 0.5,
    difficulty: overrides.difficulty ?? 0.5,
    state: overrides.state ?? null,
  }
}

const NOW = new Date('2026-07-24T12:00:00Z')

describe('Timeline engine - math', () => {
  it('intervalDays increases with mastery', () => {
    const low = intervalDays({ mastery: 0.1, confidence: 0.5, lastDelta: 0, difficulty: 0.5 })
    const high = intervalDays({ mastery: 0.9, confidence: 0.5, lastDelta: 0, difficulty: 0.5 })
    assert.ok(high > low, `expected high (${high}) > low (${low})`)
  })

  it('intervalDays decreases with high difficulty', () => {
    const easy = intervalDays({ mastery: 0.5, confidence: 0.5, lastDelta: 0, difficulty: 0.1 })
    const hard = intervalDays({ mastery: 0.5, confidence: 0.5, lastDelta: 0, difficulty: 0.9 })
    assert.ok(hard < easy, `expected hard (${hard}) < easy (${easy})`)
  })

  it('intervalDays grows with streak and is capped', () => {
    const a = intervalDays({
      mastery: 0.5,
      confidence: 0.5,
      lastDelta: 0,
      difficulty: 0.5,
      streak: 0,
    })
    const b = intervalDays({
      mastery: 0.5,
      confidence: 0.5,
      lastDelta: 0,
      difficulty: 0.5,
      streak: 3,
    })
    const c = intervalDays({
      mastery: 0.5,
      confidence: 0.5,
      lastDelta: 0,
      difficulty: 0.5,
      streak: 10,
    })
    assert.ok(b > a, `streak 3 (${b}) should exceed streak 0 (${a})`)
    assert.ok(c >= b, `streak 10 (${c}) should not be less than streak 3 (${b})`)
  })

  it('intervalDays is at least 1 day', () => {
    const d = intervalDays({ mastery: 0, confidence: 0, lastDelta: 0, difficulty: 0 })
    assert.ok(d >= 1)
  })

  it('reasonFor: never-probed → first-review; sharp drop → new-weakness; low confidence → decay', () => {
    assert.equal(
      reasonFor({ mastery: 0.5, confidence: 0.5, lastDelta: null, attempts: 0 }),
      'first-review',
    )
    assert.equal(
      reasonFor({ mastery: 0.5, confidence: 0.5, lastDelta: -0.4, attempts: 2 }),
      'new-weakness',
    )
    assert.equal(
      reasonFor({ mastery: 0.6, confidence: 0.2, lastDelta: 0.05, attempts: 3 }),
      'decay',
    )
  })

  it('priorityFor: weakness and decay outrank priority', () => {
    const decay = priorityFor({ importance: 0.5, mastery: 0.5, confidence: 0.3, reason: 'decay' })
    const weak = priorityFor({
      importance: 0.5,
      mastery: 0.5,
      confidence: 0.3,
      reason: 'new-weakness',
    })
    const flat = priorityFor({ importance: 0.5, mastery: 0.5, confidence: 0.3, reason: 'priority' })
    assert.ok(decay > flat, `decay (${decay}) > priority (${flat})`)
    assert.ok(weak > flat, `weak (${weak}) > priority (${flat})`)
  })
})

describe('Timeline engine - scheduling', () => {
  it('schedules every concept with state into the horizon', () => {
    const out = scheduleReviews({
      documentId: 'doc-1',
      now: NOW,
      concepts: [
        makeConcept({
          conceptId: 'a',
          state: {
            mastery: 0.5,
            confidence: 0.5,
            lastDelta: 0,
            lastSeen: NOW,
            dueAt: null,
            attempts: 1,
          },
        }),
        makeConcept({
          conceptId: 'b',
          state: {
            mastery: 0.2,
            confidence: 0.2,
            lastDelta: -0.1,
            lastSeen: NOW,
            dueAt: null,
            attempts: 2,
          },
        }),
      ],
    })
    assert.equal(out.diagnostics.totalConcepts, 2)
    assert.equal(out.diagnostics.scheduledConcepts, 2)
    assert.equal(out.diagnostics.droppedConcepts, 0)
  })

  it('drops well-known concepts past the horizon', () => {
    const out = scheduleReviews({
      documentId: 'doc-1',
      now: NOW,
      concepts: [
        makeConcept({
          conceptId: 'known',
          state: {
            mastery: 0.99,
            confidence: 0.99,
            lastDelta: 0,
            lastSeen: NOW,
            dueAt: null,
            attempts: 5,
          },
        }),
      ],
    })
    assert.equal(out.diagnostics.scheduledConcepts, 0)
  })

  it('first-review concepts are scheduled today', () => {
    const out = scheduleReviews({
      documentId: 'doc-1',
      now: NOW,
      concepts: [makeConcept({ conceptId: 'fresh', state: null })],
    })
    assert.equal(out.sessions.length, 1)
    assert.equal(dayKey(out.sessions[0]!.scheduledFor), dayKey(NOW))
  })

  it('respects MAX_ITEMS_PER_DAY per bucket; over-quota items slot in if higher priority', () => {
    const concepts: TimelineConceptInput[] = Array.from({ length: 12 }, (_, i) =>
      makeConcept({
        conceptId: `c-${i}`,
        importance: i < 10 ? 0.1 : 0.9, // the last 2 are most important
        state: {
          mastery: 0.4,
          confidence: 0.4,
          lastDelta: 0,
          lastSeen: NOW,
          dueAt: null,
          attempts: 1,
        },
      }),
    )
    const out = scheduleReviews({ documentId: 'doc', now: NOW, concepts })
    const bucket = out.items
    assert.ok(
      bucket.length <= MAX_ITEMS_PER_DAY,
      `expected ≤ ${MAX_ITEMS_PER_DAY}, got ${bucket.length}`,
    )
    // The high-importance items should win.
    const ids = new Set(bucket.map((b) => b.conceptId))
    assert.ok(ids.has('c-10'))
    assert.ok(ids.has('c-11'))
  })

  it('uses the default horizon', () => {
    const out = scheduleReviews({
      documentId: 'doc',
      now: NOW,
      concepts: [
        makeConcept({
          conceptId: 'c-1',
          state: {
            mastery: 0.4,
            confidence: 0.4,
            lastDelta: 0,
            lastSeen: NOW,
            dueAt: null,
            attempts: 1,
          },
        }),
      ],
    })
    assert.equal(out.diagnostics.horizonDays, DEFAULT_HORIZON_DAYS)
  })

  it('isDueToday + isOverdue classify sessions', () => {
    const past = {
      scheduledFor: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
      startedAt: null,
      completedAt: null,
      status: 'SCHEDULED',
    } as unknown as Parameters<typeof isOverdue>[0]
    const today = {
      scheduledFor: NOW,
      startedAt: null,
      completedAt: null,
      status: 'SCHEDULED',
    } as unknown as Parameters<typeof isDueToday>[0]
    assert.equal(isOverdue(past, NOW), true)
    assert.equal(isDueToday(today, NOW), true)
  })

  it('dayLabel distinguishes today / tomorrow / other', () => {
    assert.equal(dayLabel(NOW, NOW), 'today')
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
    assert.equal(dayLabel(tomorrow, NOW), 'tomorrow')
    const nextWeek = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000)
    assert.notEqual(dayLabel(nextWeek, NOW), 'today')
    assert.notEqual(dayLabel(nextWeek, NOW), 'tomorrow')
  })
})
