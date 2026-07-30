/**
 * Diagnosis session lifecycle.
 *
 * The diagnosis engine lives in `@mindmap/brain` and is purely
 * in-memory. This module is the bridge between that engine and the DB:
 * it loads the document's concepts + the user's per-concept state, hands
 * them to the engine, and persists every turn / state update / final
 * snapshot back to the database.
 *
 * Boundaries:
 *   - This file is allowed to read the database.
 *   - It calls `Brain.evaluation.*` and `Brain.conversation.*` for the
 *     actual LLM work — it never calls a provider directly.
 *   - It does not touch the SSE / Route Handlers layer; those live in
 *     `apps/web/src/app/api/diagnosis/`.
 */
import { after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { Brain, type AnswerInput, type DiagnosisQuestion, type Evaluation } from '@mindmap/brain'
import { scheduleReviewsForDocument } from '@/features/timeline/actions'
import { Err, Ok, type Result } from '@mindmap/shared'
import type { BrainError, Concept, ConceptDependency } from '@mindmap/types'
import { Prisma } from '@prisma/client'

export const AnswerInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('MCQ'),
    optionIndex: z.number().int().min(0).max(3),
    timeSpentMs: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('OPEN'),
    text: z.string().min(1).max(2000),
    timeSpentMs: z.number().int().nonnegative().optional(),
  }),
  z.object({ kind: z.literal('IDONTKNOW') }),
  z.object({ kind: z.literal('SKIP') }),
])

export type PersistedConcept = Concept & { dependencies: ConceptDependency[] }

export interface StartDiagnosisInput {
  documentId: string
  userId: string
}

export interface StartDiagnosisOutput {
  sessionId: string
  /** First question to ask, with a unique turnId for the answer route. */
  firstQuestion: {
    turnId: string
    question: DiagnosisQuestion
    questionRowId: string
  } | null
  /** If the engine decides there is nothing to probe (e.g. all probed),
   *  the session is finished and we return a completion summary. */
  finished: boolean
  globalConfidence: number
}

/** Loads the per-concept state for a (user, document) pair. */
async function loadConceptStatesForUser(userId: string, documentId: string) {
  return prisma.conceptState.findMany({
    where: { userId, concept: { documentId } },
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
}

async function loadConceptsForDocument(documentId: string): Promise<PersistedConcept[]> {
  const rows = await prisma.concept.findMany({
    where: { documentId },
    include: { dependsOn: true },
    orderBy: [{ importance: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => ({
    ...r,
    dependencies: r.dependsOn,
  }))
}

export async function startDiagnosis(
  input: StartDiagnosisInput,
): Promise<Result<StartDiagnosisOutput, BrainError>> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { locale: true, id: true },
  })
  if (!user) return Err({ kind: 'InvalidInput', message: 'User not found.' })

  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc || doc.workspace.ownerId !== input.userId) {
    return Err({ kind: 'InvalidInput', message: 'Document not found.' })
  }
  if (doc.status !== 'READY' && doc.status !== 'MAPPED' && doc.status !== 'DIAGNOSING') {
    return Err({ kind: 'InvalidInput', message: `Document is ${doc.status}; cannot diagnose.` })
  }
  const concepts = await loadConceptsForDocument(input.documentId)
  if (concepts.length === 0) {
    return Err({ kind: 'InvalidInput', message: 'Document has no concepts to diagnose.' })
  }
  // Reuse an active session if one exists. The DB is the source of truth.
  const existing = await prisma.diagnosisSession.findFirst({
    where: { documentId: input.documentId, userId: input.userId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  })

  // Load (or initialise) per-concept state.
  const prior = await loadConceptStatesForUser(input.userId, input.documentId)
  const priorMap = new Map(prior.map((p) => [p.conceptId, p]))

  const session =
    existing ??
    (await prisma.diagnosisSession.create({
      data: {
        documentId: input.documentId,
        userId: input.userId,
        status: 'ACTIVE',
        questionsAsked: 0,
        globalConfidence: 0,
      },
    }))

  // Mark the document as DIAGNOSING so the workspace list reflects it.
  await prisma.document.update({ where: { id: input.documentId }, data: { status: 'DIAGNOSING' } })

  const state = Brain.evaluation.buildState({
    sessionId: session.id,
    userId: input.userId,
    documentId: input.documentId,
    language: doc.language ?? user.locale ?? 'en',
    concepts,
    restored: {
      states: concepts.map((c) => {
        const p = priorMap.get(c.id)
        return {
          conceptId: c.id,
          mastery: p?.mastery ?? 0.1,
          confidence: p?.confidence ?? 0,
          attempts: p?.attempts ?? 0,
          correct: p?.correct ?? 0,
          lastDelta: p?.lastDelta ?? null,
          lastSeen: p?.lastSeen ?? null,
        }
      }),
      questionsAsked: session.questionsAsked,
      clarificationCount: 0,
      recentDeltas: [],
      globalConfidence: session.globalConfidence,
    },
  })

  // If the engine thinks the session is already done (e.g. all probed),
  // finalise immediately and return.
  const stop = Brain.evaluation.shouldStop(state)
  if (stop) {
    await finaliseSession({
      sessionId: session.id,
      documentId: input.documentId,
      userId: input.userId,
      states: state.states,
      globalConfidence: state.globalConfidence,
    })
    return Ok({
      sessionId: session.id,
      firstQuestion: null,
      finished: true,
      globalConfidence: state.globalConfidence,
    })
  }

  // Generate the first question just-in-time (no batch pre-generation).
  const askResult = await Brain.evaluation.askNext(state)
  if (!askResult.ok) {
    return Err({
      kind: 'InvalidInput',
      message: 'No questions could be generated. The AI provider may be temporarily unavailable.',
    })
  }

  // Persist the single question to the DB.
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
  await prisma.question.create({
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

  // Update session counters.
  await prisma.diagnosisSession.update({
    where: { id: session.id },
    data: {
      questionsAsked: 0,
      globalConfidence: askResult.value.state.globalConfidence,
    },
  })

  return Ok({
    sessionId: session.id,
    firstQuestion: { turnId: turn.id, question: askResult.value.question, questionRowId: '' },
    finished: false,
    globalConfidence: askResult.value.state.globalConfidence,
  })
}

export interface SubmitAnswerInput {
  sessionId: string
  userId: string
  turnId: string
  answer: AnswerInput
}

export interface SubmitAnswerOutput {
  finished: boolean
  microFeedback: string
  globalConfidence: number
  questionsAsked: number
  clarification: { text: string; microFeedback: string } | null
  nextQuestion: {
    turnId: string
    question: DiagnosisQuestion
    questionRowId: string
  } | null
  phase: string
  learnContent: { conceptTitle: string; explanation: string } | null
}

export async function submitAnswer(
  input: SubmitAnswerInput,
): Promise<Result<SubmitAnswerOutput, BrainError>> {
  const session = await prisma.diagnosisSession.findUnique({ where: { id: input.sessionId } })
  if (!session || session.userId !== input.userId) {
    return Err({ kind: 'InvalidInput', message: 'Session not found.' })
  }
  if (session.status !== 'ACTIVE') {
    return Err({ kind: 'InvalidInput', message: `Session is ${session.status}.` })
  }
  const turn = await prisma.conversationTurn.findUnique({ where: { id: input.turnId } })
  if (!turn || turn.sessionId !== input.sessionId) {
    return Err({ kind: 'InvalidInput', message: 'Question turn not found.' })
  }
  const question = await prisma.question.findUnique({ where: { turnId: turn.id } })
  if (!question) {
    return Err({ kind: 'InvalidInput', message: 'Question row not found.' })
  }
  // Reconstruct the in-memory state from the DB.
  const [concepts, prior, doc] = await Promise.all([
    loadConceptsForDocument(session.documentId),
    loadConceptStatesForUser(input.userId, session.documentId),
    prisma.document.findUnique({ where: { id: session.documentId } }),
  ])
  if (!doc) return Err({ kind: 'InvalidInput', message: 'Document not found.' })
  const priorMap = new Map(prior.map((p) => [p.conceptId, p]))

  const state = Brain.evaluation.buildState({
    sessionId: session.id,
    userId: input.userId,
    documentId: session.documentId,
    language: doc.language ?? 'en',
    concepts,
    restored: {
      states: concepts.map((c) => {
        const p = priorMap.get(c.id)
        return {
          conceptId: c.id,
          mastery: p?.mastery ?? 0.1,
          confidence: p?.confidence ?? 0,
          attempts: p?.attempts ?? 0,
          correct: p?.correct ?? 0,
          lastDelta: p?.lastDelta ?? null,
          lastSeen: p?.lastSeen ?? null,
        }
      }),
      questionsAsked: session.questionsAsked,
      clarificationCount: 0,
      recentDeltas: [],
      globalConfidence: session.globalConfidence,
    },
  })
  // Restore the in-memory session so the engine can append the turn.
  // (The engine's `askNext` already created the session; `scoreAnswer`
  // will append to it.)
  // We need the engine to find a session: buildInitialState re-runs the
  // prior-from-state; the turns are *not* preserved across rebuilds. For
  // the prompt history we just use the last few turns from the DB below.
  state.pending = {
    conceptId: question.conceptId,
    kind: question.options ? 'EASY' : 'HARD',
    question: {
      kind: question.options ? 'EASY' : 'HARD',
      prompt: question.prompt,
      difficulty: question.difficulty,
      ...(question.options
        ? {
            options: question.options as string[],
            correctIndex: Number(question.expectedAnswer ?? 0),
          }
        : {}),
      microFeedback: '',
    } as DiagnosisQuestion,
    tokensIn: turn.tokensIn ?? 0,
    tokensOut: turn.tokensOut ?? 0,
    providerId: turn.provider ?? 'zen',
    model: turn.model ?? '',
  }

  // Re-score. We don't have the original question row's microFeedback
  // (it was generated by the LLM); the engine doesn't need it.
  const result = await Brain.evaluation.score(state, input.answer)
  if (!result.ok) return result

  const out = result.value

  // Persist: Answer row, evaluation ConversationTurn, ConceptState updates,
  // session counters, clarification ConversationTurn (if any).
  await prisma.$transaction(async (tx) => {
    const answerRow = await tx.answer.create({
      data: {
        questionId: question.id,
        value: serializeAnswer(input.answer),
        isCorrect: out.evaluation.isCorrect,
        correctness: out.evaluation.correctness,
        rationale: out.evaluation.rationale,
        timeSpentMs: readTimeSpent(input.answer),
      },
    })
    void answerRow
    if (out.evaluation.rationale || out.evaluation.microFeedback) {
      await tx.conversationTurn.create({
        data: {
          sessionId: session.id,
          role: 'SYSTEM',
          content: out.evaluation.microFeedback,
          provider: out.providerId,
          model: out.model,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
        },
      })
    }
    // Update ConceptState rows for the targeted concept and any
    // dependencies that were propagated.
    for (const [externalId, cs] of out.state.states) {
      const concept = concepts.find((c) => c.externalId === externalId)
      if (!concept) continue
      // Only persist rows for the targeted concept + its dependencies that moved.
      const conceptChanged = cs.attempts > (priorMap.get(concept.id)?.attempts ?? 0)
      const dependencyMoved = cs.lastDelta !== null
      if (!conceptChanged && !dependencyMoved) continue
      await tx.conceptState.upsert({
        where: { conceptId_userId: { conceptId: concept.id, userId: input.userId } },
        update: {
          mastery: cs.mastery,
          confidence: cs.confidence,
          attempts: cs.attempts,
          correct: cs.correct,
          lastSeen: cs.lastSeen,
          lastDelta: cs.lastDelta,
          dueAt: nextReviewDue(cs.mastery, cs.confidence, cs.lastDelta, concept.difficulty),
        },
        create: {
          conceptId: concept.id,
          userId: input.userId,
          mastery: cs.mastery,
          confidence: cs.confidence,
          attempts: cs.attempts,
          correct: cs.correct,
          lastSeen: cs.lastSeen,
          lastDelta: cs.lastDelta,
          dueAt: nextReviewDue(cs.mastery, cs.confidence, cs.lastDelta, concept.difficulty),
        },
      })
    }
    await tx.diagnosisSession.update({
      where: { id: session.id },
      data: {
        questionsAsked: out.state.questionsAsked,
        globalConfidence: out.state.globalConfidence,
        ...(out.shouldStop && out.state.phase === 'VERIFY' ? { status: 'COMPLETED', finishedAt: new Date() } : {}),
      },
    })
    if (out.clarification) {
      await tx.conversationTurn.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: out.clarification.clarification,
          // No provider/model tracked separately for clarifications (the
          // parent score call already logged them as SYSTEM).
        },
      })
    }
  })

  // Handle phase transitions.
  let learnContent: SubmitAnswerOutput['learnContent'] = null
  if (out.shouldStop) {
    const currentPhase = out.state.phase

    if (currentPhase === 'DIAGNOSE') {
      // DIAGNOSE finished → transition to LEARN for weak concepts.
      Brain.evaluation.transitionToLearn(out.state)
      const weak = Brain.evaluation.getNextWeakConcept(out.state)
      if (weak) {
        // Generate learn content for the first weak concept.
        const learnResult = await Brain.evaluation.askLearn(out.state, weak.externalId)
        if (learnResult.ok) {
          out.state = learnResult.value.state
          learnContent = {
            conceptTitle: learnResult.value.conceptTitle,
            explanation: learnResult.value.explanation,
          }
          // Persist the learn turn.
          await prisma.conversationTurn.create({
            data: {
              sessionId: session.id,
              role: 'SYSTEM',
              content: learnResult.value.explanation,
              provider: learnResult.value.providerId,
              model: learnResult.value.model,
              tokensIn: learnResult.value.tokensIn,
              tokensOut: learnResult.value.tokensOut,
            },
          })
        }
      } else {
        // No weak concepts → skip to PRACTICE.
        Brain.evaluation.transitionToPractice(out.state)
      }
    } else if (currentPhase === 'LEARN') {
      // LEARN finished → transition to PRACTICE.
      Brain.evaluation.transitionToPractice(out.state)
    } else if (currentPhase === 'PRACTICE') {
      // PRACTICE finished → transition to VERIFY.
      Brain.evaluation.transitionToVerify(out.state)
    } else if (currentPhase === 'VERIFY') {
      // VERIFY finished → truly done.
      after(async () => {
        await finaliseSession({
          sessionId: session.id,
          documentId: session.documentId,
          userId: input.userId,
          states: out.state.states,
          globalConfidence: out.state.globalConfidence,
        })
      })
    }
  }

  // Generate the next question or learn content based on current phase.
  let nextQuestion: SubmitAnswerOutput['nextQuestion'] = null
  const currentPhase = out.state.phase

  if (currentPhase === 'LEARN' && !learnContent) {
    // In LEARN phase: get next weak concept to teach.
    const weak = Brain.evaluation.getNextWeakConcept(out.state)
    if (weak) {
      const learnResult = await Brain.evaluation.askLearn(out.state, weak.externalId)
      if (learnResult.ok) {
        out.state = learnResult.value.state
        learnContent = {
          conceptTitle: learnResult.value.conceptTitle,
          explanation: learnResult.value.explanation,
        }
        await prisma.conversationTurn.create({
          data: {
            sessionId: session.id,
            role: 'SYSTEM',
            content: learnResult.value.explanation,
            provider: learnResult.value.providerId,
            model: learnResult.value.model,
            tokensIn: learnResult.value.tokensIn,
            tokensOut: learnResult.value.tokensOut,
          },
        })
      }
    }
  } else if (
    currentPhase === 'PRACTICE' ||
    currentPhase === 'VERIFY' ||
    currentPhase === 'DIAGNOSE'
  ) {
    // In DIAGNOSE/PRACTICE/VERIFY: generate the next question.
    if (!out.shouldStop || currentPhase !== 'DIAGNOSE') {
      const nextResult = await Brain.evaluation.askNext(out.state)
      if (nextResult.ok) {
        const nextTurn = await prisma.conversationTurn.create({
          data: {
            sessionId: session.id,
            role: 'ASSISTANT',
            content: nextResult.value.question.prompt,
            provider: nextResult.value.pending.providerId,
            model: nextResult.value.pending.model,
            tokensIn: nextResult.value.pending.tokensIn,
            tokensOut: nextResult.value.pending.tokensOut,
          },
        })
        const nextQ = await prisma.question.create({
          data: {
            turnId: nextTurn.id,
            conceptId: nextResult.value.pending.conceptId,
            difficulty: nextResult.value.question.difficulty,
            prompt: nextResult.value.question.prompt,
            options:
              nextResult.value.question.kind === 'EASY'
                ? (nextResult.value.question.options as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            expectedAnswer:
              nextResult.value.question.kind === 'EASY'
                ? String(nextResult.value.question.correctIndex)
                : null,
          },
        })
        nextQuestion = {
          turnId: nextTurn.id,
          question: nextResult.value.question,
          questionRowId: nextQ.id,
        }
      }
    }
  }

  return Ok({
    finished: currentPhase === 'VERIFY' && out.shouldStop,
    microFeedback: out.microFeedback,
    globalConfidence: out.state.globalConfidence,
    questionsAsked: out.state.questionsAsked,
    clarification: out.clarification
      ? { text: out.clarification.clarification, microFeedback: out.clarification.microFeedback }
      : null,
    nextQuestion,
    phase: currentPhase,
    learnContent,
  })
}

/**
 * Apply a Socratic clarification follow-up. The user already answered an
 * ambiguous question; this records their follow-up text and re-evaluates.
 */
export async function applyClarification(input: {
  sessionId: string
  userId: string
  followUp: string
}): Promise<
  Result<
    { evaluation: Evaluation; finished: boolean; globalConfidence: number; questionsAsked: number },
    BrainError
  >
> {
  const session = await prisma.diagnosisSession.findUnique({ where: { id: input.sessionId } })
  if (!session || session.userId !== input.userId) {
    return Err({ kind: 'InvalidInput', message: 'Session not found.' })
  }
  if (session.status !== 'ACTIVE') {
    return Err({ kind: 'InvalidInput', message: `Session is ${session.status}.` })
  }
  const [concepts, prior, doc] = await Promise.all([
    loadConceptsForDocument(session.documentId),
    loadConceptStatesForUser(input.userId, session.documentId),
    prisma.document.findUnique({ where: { id: session.documentId } }),
  ])
  if (!doc) return Err({ kind: 'InvalidInput', message: 'Document not found.' })
  const priorMap = new Map(prior.map((p) => [p.conceptId, p]))
  const state = Brain.evaluation.buildState({
    sessionId: session.id,
    userId: input.userId,
    documentId: session.documentId,
    language: doc.language ?? 'en',
    concepts,
    restored: {
      states: concepts.map((c) => {
        const p = priorMap.get(c.id)
        return {
          conceptId: c.id,
          mastery: p?.mastery ?? 0.1,
          confidence: p?.confidence ?? 0,
          attempts: p?.attempts ?? 0,
          correct: p?.correct ?? 0,
          lastDelta: p?.lastDelta ?? null,
          lastSeen: p?.lastSeen ?? null,
        }
      }),
      questionsAsked: session.questionsAsked,
      clarificationCount: 0,
      recentDeltas: [],
      globalConfidence: session.globalConfidence,
    },
  })
  state.awaitingClarification = true
  // The pending question is the most-recent unanswered one in the DB.
  const lastQ = await prisma.question.findFirst({
    where: { turn: { sessionId: session.id } },
    orderBy: { id: 'desc' },
  })
  if (!lastQ) {
    return Err({ kind: 'InvalidInput', message: 'No question to clarify.' })
  }
  state.pendingClarification = {
    clarification: 'pending',
    microFeedback: '',
  }
  // We need to find the right state; the engine's resolveClarification
  // already does the right thing if state.awaitingClarification is set.
  const result = await Brain.evaluation.applyClarification(state, input.followUp)
  if (!result.ok) return result

  await prisma.$transaction(async (tx) => {
    await tx.conversationTurn.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content: input.followUp,
      },
    })
    await tx.conversationTurn.create({
      data: {
        sessionId: session.id,
        role: 'SYSTEM',
        content: result.value.evaluation.microFeedback,
      },
    })
    for (const [externalId, cs] of result.value.state.states) {
      const concept = concepts.find((c) => c.externalId === externalId)
      if (!concept) continue
      const before = priorMap.get(concept.id)
      if (!before || before.mastery === cs.mastery) continue
      await tx.conceptState.upsert({
        where: { conceptId_userId: { conceptId: concept.id, userId: input.userId } },
        update: {
          mastery: cs.mastery,
          confidence: cs.confidence,
          lastSeen: cs.lastSeen,
          lastDelta: cs.lastDelta,
          dueAt: nextReviewDue(cs.mastery, cs.confidence, cs.lastDelta, concept.difficulty),
        },
        create: {
          conceptId: concept.id,
          userId: input.userId,
          mastery: cs.mastery,
          confidence: cs.confidence,
          attempts: cs.attempts,
          correct: cs.correct,
          lastSeen: cs.lastSeen,
          lastDelta: cs.lastDelta,
          dueAt: nextReviewDue(cs.mastery, cs.confidence, cs.lastDelta, concept.difficulty),
        },
      })
    }
    await tx.diagnosisSession.update({
      where: { id: session.id },
      data: {
        globalConfidence: result.value.state.globalConfidence,
      },
    })
  })

  return Ok({
    evaluation: result.value.evaluation,
    finished: false,
    globalConfidence: result.value.state.globalConfidence,
    questionsAsked: result.value.state.questionsAsked,
  })
}

export async function getNextQuestion(input: { sessionId: string; userId: string }): Promise<
  Result<
    | {
        turnId: string
        question: DiagnosisQuestion
        questionRowId: string
        finished: false
        globalConfidence: number
      }
    | { finished: true; globalConfidence: number },
    BrainError
  >
> {
  const session = await prisma.diagnosisSession.findUnique({ where: { id: input.sessionId } })
  if (!session || session.userId !== input.userId) {
    return Err({ kind: 'InvalidInput', message: 'Session not found.' })
  }
  if (session.status !== 'ACTIVE') {
    return Ok({ finished: true, globalConfidence: session.globalConfidence })
  }

  // Check if there's already an unanswered question in the DB (from a previous
  // partial batch or a concurrent request). If so, serve it.
  const existingTurn = await prisma.conversationTurn.findFirst({
    where: {
      sessionId: session.id,
      role: 'ASSISTANT',
      question: { answer: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { question: true },
  })

  if (existingTurn && existingTurn.question) {
    const q = existingTurn.question
    const question: DiagnosisQuestion = q.options
      ? {
          kind: 'EASY',
          prompt: q.prompt,
          options: q.options as string[],
          correctIndex: Number(q.expectedAnswer ?? 0),
          difficulty: q.difficulty,
          microFeedback: '',
        }
      : { kind: 'HARD', prompt: q.prompt, difficulty: q.difficulty, microFeedback: '' }

    return Ok({
      turnId: existingTurn.id,
      question,
      questionRowId: q.id,
      finished: false,
      globalConfidence: session.globalConfidence,
    })
  }

  // No existing question — generate one just-in-time.
  const [concepts, prior, doc] = await Promise.all([
    loadConceptsForDocument(session.documentId),
    loadConceptStatesForUser(input.userId, session.documentId),
    prisma.document.findUnique({ where: { id: session.documentId } }),
  ])
  if (!doc) return Err({ kind: 'InvalidInput', message: 'Document not found.' })
  const priorMap = new Map(prior.map((p) => [p.conceptId, p]))

  const state = Brain.evaluation.buildState({
    sessionId: session.id,
    userId: input.userId,
    documentId: session.documentId,
    language: doc.language ?? 'en',
    concepts,
    restored: {
      states: concepts.map((c) => {
        const p = priorMap.get(c.id)
        return {
          conceptId: c.id,
          mastery: p?.mastery ?? 0.1,
          confidence: p?.confidence ?? 0,
          attempts: p?.attempts ?? 0,
          correct: p?.correct ?? 0,
          lastDelta: p?.lastDelta ?? null,
          lastSeen: p?.lastSeen ?? null,
        }
      }),
      questionsAsked: session.questionsAsked,
      clarificationCount: 0,
      recentDeltas: [],
      globalConfidence: session.globalConfidence,
    },
  })

  if (Brain.evaluation.shouldStop(state)) {
    await finaliseSession({
      sessionId: session.id,
      documentId: session.documentId,
      userId: input.userId,
      states: state.states,
      globalConfidence: state.globalConfidence,
    })
    return Ok({ finished: true, globalConfidence: state.globalConfidence })
  }

  const askResult = await Brain.evaluation.askNext(state)
  if (!askResult.ok) return askResult

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

  return Ok({
    turnId: turn.id,
    question: askResult.value.question,
    questionRowId: qRow.id,
    finished: false,
    globalConfidence: askResult.value.state.globalConfidence,
  })
}

export interface SessionSnapshot {
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'ERRORED'
  questionsAsked: number
  globalConfidence: number
  documentId: string
  documentStatus: string
  pendingQuestion: {
    turnId: string
    question: DiagnosisQuestion
    microFeedback: string
  } | null
  awaitingClarification: boolean
  finished: boolean
  language: string
  maxQuestions: number
}

export async function loadSessionSnapshot(
  sessionId: string,
  userId: string,
): Promise<SessionSnapshot | null> {
  const session = await prisma.diagnosisSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== userId) return null
  const doc = await prisma.document.findUnique({
    where: { id: session.documentId },
    select: { status: true, language: true },
  })
  if (!doc) return null
  const maxQuestions = Brain.evaluation.MAX_QUESTIONS
  let pendingQuestion: SessionSnapshot['pendingQuestion'] = null
  let awaitingClarification = false
  if (session.status === 'ACTIVE') {
    // Find the last ASSISTANT turn that doesn't have a matching USER/SYSTEM answer.
    const lastAssistant = await prisma.conversationTurn.findFirst({
      where: { sessionId, role: 'ASSISTANT' },
      orderBy: { createdAt: 'desc' },
    })
    if (lastAssistant) {
      const question = await prisma.question.findUnique({ where: { turnId: lastAssistant.id } })
      if (question) {
        const answer = await prisma.answer.findUnique({ where: { questionId: question.id } })
        if (!answer) {
          pendingQuestion = {
            turnId: lastAssistant.id,
            question: reconstructQuestion(question),
            microFeedback: '',
          }
        }
      }
    }
    awaitingClarification = pendingQuestion !== null && (await hasPendingClarification(sessionId))
  }
  return {
    status: session.status,
    questionsAsked: session.questionsAsked,
    globalConfidence: session.globalConfidence,
    documentId: session.documentId,
    documentStatus: doc.status,
    pendingQuestion,
    awaitingClarification,
    finished: session.status !== 'ACTIVE',
    language: doc.language ?? 'en',
    maxQuestions,
  }
}

async function hasPendingClarification(sessionId: string): Promise<boolean> {
  // A pending clarification is the most-recent ASSISTANT turn whose
  // content is not a question prompt. (i.e., a clarification question.)
  // We detect by checking the last ASSISTANT turn and the last USER turn.
  const [lastAssistant, lastUser] = await Promise.all([
    prisma.conversationTurn.findFirst({
      where: { sessionId, role: 'ASSISTANT' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.conversationTurn.findFirst({
      where: { sessionId, role: 'USER' },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!lastAssistant) return false
  if (!lastUser) return false
  return lastAssistant.createdAt > lastUser.createdAt
}

function reconstructQuestion(q: {
  prompt: string
  difficulty: number
  options: unknown
  expectedAnswer: string | null
}): DiagnosisQuestion {
  if (Array.isArray(q.options)) {
    return {
      kind: 'EASY',
      prompt: q.prompt,
      options: q.options as string[],
      correctIndex: Number(q.expectedAnswer ?? 0),
      difficulty: q.difficulty,
      microFeedback: '',
    }
  }
  return {
    kind: 'HARD',
    prompt: q.prompt,
    difficulty: q.difficulty,
    microFeedback: '',
  }
}

function serializeAnswer(a: AnswerInput): string {
  switch (a.kind) {
    case 'MCQ':
      return String(a.optionIndex)
    case 'OPEN':
      return a.text
    case 'IDONTKNOW':
      return 'IDONTKNOW'
    case 'SKIP':
      return 'SKIP'
  }
}

function readTimeSpent(a: AnswerInput): number | null {
  return a.kind === 'MCQ' || a.kind === 'OPEN' ? (a.timeSpentMs ?? null) : null
}

function nextReviewDue(
  mastery: number,
  confidence: number,
  lastDelta: number | null = null,
  difficulty: number = 0.5,
  streak: number = 0,
): Date {
  // Use the real spaced repetition formula from the timeline engine.
  const days = Brain.timeline.intervalDays({
    mastery,
    confidence,
    lastDelta,
    difficulty,
    streak,
  })
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function finaliseSession(input: {
  sessionId: string
  documentId: string
  userId: string
  states: Map<string, { mastery: number; confidence: number; conceptId: string }>
  globalConfidence: number
}): Promise<void> {
  // Persist final ConceptState snapshots, set the document to MAPPED,
  // and (re)build the ReviewPlan for this document so the timeline
  // shows the user's first review session.
  await prisma.$transaction([
    prisma.reviewPlan.upsert({
      where: { documentId: input.documentId },
      update: {},
      create: { documentId: input.documentId },
    }),
    prisma.document.update({
      where: { id: input.documentId },
      data: { status: 'MAPPED' },
    }),
  ])
  await scheduleReviewsForDocument(input.documentId, input.userId)
}

/** Helper for routes that need a user-friendly error wrapper. */
export async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}
