/**
 * Timeline + Review session lifecycle.
 *
 *   - {@link scheduleReviewsForDocument} rebuilds the `ReviewPlan` for a
 *     document using the pure-math timeline engine. Called when a
 *     diagnosis completes and after every review.
 *   - {@link loadTimelineForUser} returns today's `ReviewSession` (if
 *     any) plus the next 6 upcoming days, for the Timeline view.
 *   - {@link startReviewSession} / {@link submitReviewAnswers} drive the
 *     review loop: a short, re-evaluation round per item, no new
 *     concept discovery.
 *   - {@link loadHistoryForUser} returns the last N completed sessions
 *     (diagnosis + review) for the History view.
 */
import { prisma } from '@mindmap/database'
import { Brain } from '@mindmap/brain'
import { getCurrentUser } from '@mindmap/auth'
import type { ReviewStatus } from '@mindmap/types'
import { Prisma } from '@prisma/client'

export interface ReviewDay {
  key: string
  scheduledFor: Date
  status: ReviewStatus
  sessionId: string | null
  documentId: string
  documentName: string
  items: ReviewItemView[]
  isToday: boolean
  isOverdue: boolean
  itemCountLabel?: string
}

export interface ReviewItemView {
  itemId: string
  conceptId: string
  title: string
  chapter: string | null
  topic: string | null
  mastery: number
  confidence: number
  importance: number
  reason: string
  priority: number
}

export interface TimelineView {
  today: ReviewDay | null
  upcoming: ReviewDay[]
  overdue: ReviewDay[]
  stats: {
    sessionsDueToday: number
    sessionsUpcoming: number
    itemsDueToday: number
    itemsUpcoming: number
  }
}

export interface HistoryEntry {
  id: string
  kind: 'diagnosis' | 'review'
  documentId: string
  documentName: string
  startedAt: Date
  finishedAt: Date | null
  questionsAsked: number
  finalConfidence: number
  previousConfidence: number | null
  delta: number | null
  deltaLabel?: string
  questionsLabel?: string
}

export interface HistoryView {
  entries: HistoryEntry[]
  totalEntries: number
  globalConfidence: number
}

interface ConceptForSchedule {
  conceptId: string
  title: string
  chapter: string | null
  topic: string | null
  importance: number
  difficulty: number
  state: {
    mastery: number
    confidence: number
    lastDelta: number | null
    lastSeen: Date | null
    dueAt: Date | null
    attempts: number
  } | null
}

/**
 * Rebuild a `ReviewPlan` for the given document from the user's current
 * `ConceptState` rows. Idempotent: replacing the plan replaces its
 * sessions and items, so the user always sees a fresh, deduped schedule.
 */
export async function scheduleReviewsForDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const [doc, concepts, states] = await Promise.all([
    prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, workspace: { select: { examDate: true } } },
    }),
    prisma.concept.findMany({
      where: { documentId },
      select: {
        id: true,
        title: true,
        chapter: true,
        topic: true,
        importance: true,
        difficulty: true,
      },
    }),
    prisma.conceptState.findMany({
      where: { userId, concept: { documentId } },
      select: {
        conceptId: true,
        mastery: true,
        confidence: true,
        lastDelta: true,
        lastSeen: true,
        dueAt: true,
        attempts: true,
      },
    }),
  ])
  if (!doc) return
  const stateMap = new Map(states.map((s) => [s.conceptId, s]))
  const input: ConceptForSchedule[] = concepts.map((c) => {
    const s = stateMap.get(c.id)
    return {
      conceptId: c.id,
      title: c.title,
      chapter: c.chapter,
      topic: c.topic,
      importance: c.importance,
      difficulty: c.difficulty,
      state: s
        ? {
            mastery: s.mastery,
            confidence: s.confidence,
            lastDelta: s.lastDelta,
            lastSeen: s.lastSeen,
            dueAt: s.dueAt,
            attempts: s.attempts,
          }
        : null,
    }
  })

  const out = Brain.timeline.scheduleReviews({
    documentId,
    examDate: doc?.workspace?.examDate ?? undefined,
    concepts: input,
  })
  if (!out.ok) return

  // Persist: upsert plan, delete old sessions/items, recreate.
  await prisma.$transaction(async (tx) => {
    const planRow = await tx.reviewPlan.upsert({
      where: { documentId },
      update: {},
      create: { documentId },
    })
    await tx.reviewSession.deleteMany({ where: { planId: planRow.id } })
    for (const s of out.value.sessions) {
      const session = await tx.reviewSession.create({
        data: {
          planId: planRow.id,
          userId,
          scheduledFor: s.scheduledFor,
          status: 'SCHEDULED',
        },
      })
      for (const item of s.items) {
        await tx.reviewItem.create({
          data: {
            sessionId: session.id,
            conceptId: item.conceptId,
            priority: item.priority,
            reason: item.reason,
          },
        })
      }
    }
  })
}

/**
 * Load the timeline for a user: today's session (if any) + the next
 * 6 upcoming days, plus any overdue sessions.
 */
export async function loadTimelineForUser(userId: string): Promise<TimelineView> {
  const now = new Date()
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const sessions = await prisma.reviewSession.findMany({
    where: {
      userId,
      OR: [
        { scheduledFor: { gte: now, lte: horizon } },
        { scheduledFor: { lt: now }, status: 'SCHEDULED' },
      ],
    },
    include: {
      plan: { include: { document: { select: { id: true, filename: true } } } },
      items: true,
    },
    orderBy: { scheduledFor: 'asc' },
    take: 25,
  })

  // Collect all conceptIds we need to hydrate.
  const conceptIds = new Set<string>()
  for (const s of sessions) for (const it of s.items) conceptIds.add(it.conceptId)
  const ids = Array.from(conceptIds)
  const [concepts, states] = await Promise.all([
    ids.length
      ? prisma.concept.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true, chapter: true, topic: true, importance: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.conceptState.findMany({
          where: { userId, conceptId: { in: ids } },
          select: { conceptId: true, mastery: true, confidence: true },
        })
      : Promise.resolve([]),
  ])
  const conceptMap = new Map(concepts.map((c) => [c.id, c]))
  const stateMap = new Map(states.map((cs) => [cs.conceptId, cs]))

  const groups = new Map<string, ReviewDay>()
  for (const s of sessions) {
    const key = dayKey(s.scheduledFor)
    const day: ReviewDay = groups.get(key) ?? {
      key,
      scheduledFor: s.scheduledFor,
      status: s.status,
      sessionId: s.id,
      documentId: s.plan.documentId,
      documentName: s.plan.document.filename,
      items: [],
      isToday: key === dayKey(now),
      isOverdue: s.scheduledFor.getTime() < now.getTime() && s.status === 'SCHEDULED',
    }
    for (const it of s.items) {
      const c = conceptMap.get(it.conceptId)
      const st = stateMap.get(it.conceptId)
      if (!c) continue
      day.items.push({
        itemId: it.id,
        conceptId: it.conceptId,
        title: c.title,
        chapter: c.chapter,
        topic: c.topic,
        mastery: st?.mastery ?? 0.1,
        confidence: st?.confidence ?? 0,
        importance: c.importance,
        reason: it.reason,
        priority: it.priority,
      })
    }
    if (s.status === 'DUE' || s.status === 'STARTED') {
      day.status = s.status
    }
    day.items.sort((a, b) => b.priority - a.priority)
    groups.set(key, day)
  }

  const days = Array.from(groups.values()).sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime(),
  )
  const today = days.find((d) => d.isToday) ?? null
  const upcoming = days.filter((d) => !d.isToday && !d.isOverdue)
  const overdue = days.filter((d) => d.isOverdue)

  return {
    today,
    upcoming,
    overdue,
    stats: {
      sessionsDueToday: today ? 1 : 0,
      sessionsUpcoming: upcoming.length,
      itemsDueToday: today?.items.length ?? 0,
      itemsUpcoming: upcoming.reduce((acc, d) => acc + d.items.length, 0),
    },
  }
}

export interface ActiveReviewView {
  sessionId: string
  documentId: string
  documentName: string
  status: ReviewStatus
  startedAt: Date
  items: ReviewItemView[]
  firstQuestion: {
    turnId: string
    question: import('@mindmap/brain').DiagnosisQuestion
    questionRowId: string
    conceptId: string
  } | null
}

/**
 * Mark a `ReviewSession` as STARTED and return its items so the UI can
 * ask the user to re-evaluate them.
 */
export async function startReviewSession(
  sessionId: string,
  userId: string,
): Promise<ActiveReviewView | null> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
    include: {
      plan: { include: { document: { select: { id: true, filename: true } } } },
      items: true,
    },
  })
  if (!session || session.userId !== userId) return null
  if (session.status === 'COMPLETED' || session.status === 'SKIPPED') {
    return null
  }
  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      status: 'STARTED',
      startedAt: session.startedAt ?? new Date(),
    },
  })
  const conceptIds = session.items.map((it) => it.conceptId)
  const [concepts, states, doc] = await Promise.all([
    conceptIds.length
      ? prisma.concept.findMany({
          where: { id: { in: conceptIds } },
          select: {
            id: true,
            externalId: true,
            title: true,
            chapter: true,
            topic: true,
            importance: true,
            difficulty: true,
            summary: true,
          },
        })
      : Promise.resolve([]),
    conceptIds.length
      ? prisma.conceptState.findMany({
          where: { userId, conceptId: { in: conceptIds } },
          select: {
            conceptId: true,
            mastery: true,
            confidence: true,
            attempts: true,
            correct: true,
            lastDelta: true,
            lastSeen: true,
          },
        })
      : Promise.resolve([]),
    prisma.document.findUnique({
      where: { id: session.plan.documentId },
      select: { language: true },
    }),
  ])
  const conceptMap = new Map(concepts.map((c) => [c.id, c]))
  const stateMap = new Map(states.map((cs) => [cs.conceptId, cs]))

  // Generate a real question for the first item using the brain engine.
  let firstQuestion: ActiveReviewView['firstQuestion'] = null
  if (concepts.length > 0 && session.items.length > 0) {
    const firstItem = session.items[0]!
    const firstConcept = conceptMap.get(firstItem.conceptId)
    if (firstConcept) {
      // Build engine state for question generation.
      const engineState = Brain.evaluation.buildState({
        sessionId: session.id,
        userId,
        documentId: session.plan.documentId,
        language: doc?.language ?? 'en',
        concepts: concepts.map((c) => ({
          ...c,
          createdAt: new Date(),
          documentId: session.plan.documentId,
          dependencies: [],
        })),
        restored: {
          states: concepts.map((c) => {
            const st = stateMap.get(c.id)
            return {
              conceptId: c.id,
              mastery: st?.mastery ?? 0.1,
              confidence: st?.confidence ?? 0,
              attempts: st?.attempts ?? 0,
              correct: st?.correct ?? 0,
              lastDelta: st?.lastDelta ?? null,
              lastSeen: st?.lastSeen ?? null,
            }
          }),
          questionsAsked: 0,
          clarificationCount: 0,
          recentDeltas: [],
          globalConfidence: 0,
        },
      })

      const askResult = await Brain.evaluation.askNext(engineState)
      if (askResult.ok) {
        const turn = await prisma.conversationTurn.create({
          data: {
            sessionId: session.id,
            role: 'ASSISTANT',
            content: askResult.value.question.prompt,
            provider: askResult.value.pending.providerId,
            model: askResult.value.pending.model,
            tokensIn: askResult.value.pending.tokensIn,
            tokensOut: askResult.value.pending.tokensOut,
          },
        })
        const qRow = await prisma.question.create({
          data: {
            turnId: turn.id,
            conceptId: askResult.value.pending.conceptId,
            difficulty: askResult.value.question.difficulty,
            prompt: askResult.value.question.prompt,
            options:
              askResult.value.question.kind === 'EASY'
                ? (askResult.value.question.options as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            expectedAnswer:
              askResult.value.question.kind === 'EASY'
                ? String(askResult.value.question.correctIndex)
                : null,
          },
        })
        firstQuestion = {
          turnId: turn.id,
          question: askResult.value.question,
          questionRowId: qRow.id,
          conceptId: askResult.value.pending.conceptId,
        }
      }
    }
  }

  return {
    sessionId,
    documentId: session.plan.documentId,
    documentName: session.plan.document.filename,
    status: 'STARTED',
    startedAt: session.startedAt ?? new Date(),
    items: session.items
      .map((it) => {
        const c = conceptMap.get(it.conceptId)
        const st = stateMap.get(it.conceptId)
        if (!c) return null
        return {
          itemId: it.id,
          conceptId: it.conceptId,
          title: c.title,
          chapter: c.chapter,
          topic: c.topic,
          mastery: st?.mastery ?? 0.1,
          confidence: st?.confidence ?? 0,
          importance: c.importance,
          reason: it.reason,
          priority: it.priority,
        }
      })
      .filter((x): x is ReviewItemView => x !== null)
      .sort((a, b) => b.priority - a.priority),
    firstQuestion,
  }
}

/**
 * Score a batch of review answers. Each item is "I knew it" / "I
 * didn't" / "Skip"; we update the per-concept mastery/confidence with
 * a small Bayesian nudge and reschedule.
 */
export interface ReviewAnswerInput {
  itemId: string
  conceptId: string
  result: 'knew' | 'didnt' | 'skip'
}
export interface CompleteReviewOutput {
  sessionId: string
  completedAt: Date
  items: number
  nextScheduledFor: Date | null
  averageDelta: number
}

export async function submitReviewAnswers(
  sessionId: string,
  userId: string,
  answers: ReviewAnswerInput[],
): Promise<CompleteReviewOutput | null> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
    include: { plan: { select: { documentId: true } } },
  })
  if (!session || session.userId !== userId) return null
  if (session.status === 'COMPLETED') return null
  const now = new Date()
  let totalDelta = 0
  let n = 0
  for (const a of answers) {
    const cs = await prisma.conceptState.findUnique({
      where: { conceptId_userId: { conceptId: a.conceptId, userId } },
    })
    if (!cs) continue
    const beforeM = cs.mastery
    let { mastery, confidence } = cs
    if (a.result === 'knew') {
      mastery = Math.min(1, mastery + 0.12 * (1 - mastery))
      confidence = Math.min(1, confidence + 0.05)
    } else if (a.result === 'didnt') {
      mastery = Math.max(0, mastery - 0.12)
      confidence = Math.min(1, confidence + 0.1)
    } else {
      confidence = Math.max(0, confidence - 0.08)
    }
    const lastDelta = mastery - beforeM
    await prisma.conceptState.update({
      where: { conceptId_userId: { conceptId: a.conceptId, userId } },
      data: {
        mastery,
        confidence,
        lastDelta,
        lastSeen: now,
        dueAt: dueAfter(mastery, confidence, lastDelta),
        attempts: cs.attempts + 1,
        ...(a.result === 'knew' ? { correct: cs.correct + 1 } : {}),
      },
    })
    totalDelta += Math.abs(lastDelta)
    n += 1
  }
  await prisma.reviewSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      completedAt: now,
    },
  })
  // Re-schedule the document. Cheap (one engine call, no LLM).
  if (session.plan.documentId) {
    await scheduleReviewsForDocument(session.plan.documentId, userId)
  }
  const next = await prisma.reviewSession.findFirst({
    where: { userId, status: 'SCHEDULED' },
    orderBy: { scheduledFor: 'asc' },
    select: { scheduledFor: true },
  })
  return {
    sessionId,
    completedAt: now,
    items: n,
    nextScheduledFor: next?.scheduledFor ?? null,
    averageDelta: n === 0 ? 0 : totalDelta / n,
  }
}

export async function loadHistoryForUser(
  userId: string,
  workspaceId: string,
  limit = 10,
): Promise<HistoryView> {
  const [diagnosisSessions, reviewSessions, aggregate] = await Promise.all([
    prisma.diagnosisSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        document: { workspaceId },
      },
      orderBy: { finishedAt: 'desc' },
      take: limit,
      include: { document: { select: { id: true, filename: true } } },
    }),
    prisma.reviewSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        plan: { document: { workspaceId } },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        plan: { include: { document: { select: { id: true, filename: true } } } },
        items: { select: { id: true } },
      },
    }),
    prisma.conceptState.aggregate({
      where: { userId, concept: { document: { workspaceId } } },
      _avg: { mastery: true },
    }),
  ])
  const entries: HistoryEntry[] = []
  for (const d of diagnosisSessions) {
    const prior = await prisma.diagnosisSession.findFirst({
      where: { userId, documentId: d.documentId, finishedAt: { lt: d.finishedAt ?? new Date(0) } },
      orderBy: { finishedAt: 'desc' },
      select: { globalConfidence: true },
    })
    entries.push({
      id: d.id,
      kind: 'diagnosis',
      documentId: d.documentId,
      documentName: d.document.filename,
      startedAt: d.startedAt,
      finishedAt: d.finishedAt,
      questionsAsked: d.questionsAsked,
      finalConfidence: d.globalConfidence,
      previousConfidence: prior?.globalConfidence ?? null,
      delta: prior ? d.globalConfidence - prior.globalConfidence : null,
    })
  }
  for (const r of reviewSessions) {
    entries.push({
      id: r.id,
      kind: 'review',
      documentId: r.plan.documentId,
      documentName: r.plan.document.filename,
      startedAt: r.startedAt ?? r.scheduledFor,
      finishedAt: r.completedAt,
      questionsAsked: r.items.length,
      finalConfidence: 0,
      previousConfidence: null,
      delta: null,
    })
  }
  entries.sort((a, b) => {
    const aT = (a.finishedAt ?? a.startedAt).getTime()
    const bT = (b.finishedAt ?? b.startedAt).getTime()
    return bT - aT
  })
  return {
    entries: entries.slice(0, limit),
    totalEntries: entries.length,
    globalConfidence: aggregate._avg.mastery ?? 0,
  }
}

/** Convenience: get the current user id from the auth helper. */
export async function requireUserId(): Promise<string | null> {
  const u = await getCurrentUser()
  return u?.id ?? null
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dueAfter(
  mastery: number,
  confidence: number,
  lastDelta: number | null = null,
  difficulty: number = 0.5,
  streak: number = 0,
): Date {
  const days = Brain.timeline.intervalDays({
    mastery,
    confidence,
    lastDelta,
    difficulty,
    streak,
  })
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
