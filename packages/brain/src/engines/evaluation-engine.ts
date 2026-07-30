/**
 * Evaluation Engine - phase 5.
 *
 *   The signature experience. A `DiagnosisEngineState` is the in-memory
 *   representation of a live diagnosis session; the engine mutates it via
 *   the two pure-ish operations:
 *
 *     - {@link pickNextQuestion} - ask the LLM for a new question for
 *       the concept with the highest priority.
 *     - {@link submitAnswer} - score the user's answer with the LLM,
 *       apply the Bayesian update, propagate to neighbors, and check
 *       the stopping rule.
 *
 *   The engine is provider-aware (it calls a `ProviderAdapter` for LLM
 *   work) but never DB-aware. Persistence lives in
 *   `apps/web/features/diagnosis/`, which snapshots/restores the state
 *   into the `DiagnosisSession` + `ConceptState` + `ConversationTurn` rows.
 *
 *   Math references live in `./irt.ts` and `./bayesian.ts`. Session
 *   memory (turns, notes) lives in `./memory.ts`.
 */
import type { z } from 'zod'
import type { Concept, ConceptDependency, ParsedDocument, TaskType } from '@mindmap/types'
import { Err, Ok, type Result } from '@mindmap/shared'
import { loadPrompt } from '@mindmap/prompts'
import { withSchemaRepair } from '../retry'
import { recordCallTokens, pickRouteWithProvider, markProviderBad, isCandidateBad } from '../router'
import type { ChatResponse } from '../providers/provider'
import {
  ClarificationSchema,
  DiagnoseEasySchema,
  DiagnoseHardSchema,
  EvaluationSchema,
  LearnSchema,
  type AnswerInput,
  type Clarification,
  type DiagnosisQuestion,
  type Evaluation,
} from '../schemas/diagnosis'
import { fisherInformation, masteryToTheta } from './irt'
import {
  moments,
  priorFromState,
  type Density,
  updateWithEvidence,
  updateWithIDontKnow,
  updateWithSkip,
} from './bayesian'
import type { ActiveSession, SessionTurn } from './memory'
import { getSession, registerSession, turnWindow } from './memory'
import type { BrainError } from '../errors'

export const MAX_QUESTIONS = 35
export const STOP_GLOBAL_CONFIDENCE = 0.7
export const STOP_DELTA_THRESHOLD = 0.02
export const STOP_STAGNANT_RUNS = 3
/** Correctness in this band triggers an optional Socratic clarification. */
export const CLARIFY_LO = 0.3
export const CLARIFY_HI = 0.7
export const CLARIFY_PER_QUESTION_MAX = 1
export const CLARIFY_PER_SESSION_MAX = 3

export type QuestionKind = 'EASY' | 'HARD'

export type DiagnosisPhase = 'DIAGNOSE' | 'LEARN' | 'PRACTICE' | 'VERIFY'

export interface ConceptStateLocal {
  conceptId: string
  mastery: number
  confidence: number
  attempts: number
  correct: number
  density: Density
  lastDelta: number | null
  lastSeen: Date | null
}

export interface PendingQuestion {
  conceptId: string
  kind: QuestionKind
  question: DiagnosisQuestion
  tokensIn: number
  tokensOut: number
  providerId: string
  model: string
}

export interface DiagnosisEngineState {
  sessionId: string
  userId: string
  documentId: string
  language: string
  concepts: Array<{
    id: string
    externalId: string
    title: string
    summary: string
    importance: number
    difficulty: number
    chapter: string | null
    topic: string | null
  }>
  edges: Array<{ from: string; to: string; weight: number }>
  /** externalId → state. externalId is the stable key across rehydration. */
  states: Map<string, ConceptStateLocal>
  questionsAsked: number
  clarificationCount: number
  /** Recent mastery deltas, used by the stagnation stopping rule. */
  recentDeltas: number[]
  globalConfidence: number
  pending: PendingQuestion | null
  maxQuestions: number
  /** Concepts already selected in the current batch (reset on answer). */
  selectedInBatch: Set<string>
  /** True if the most recent answer was clarification-gated. */
  awaitingClarification: boolean
  /** clarification follow-up produced for the current question, if any. */
  pendingClarification: Clarification | null
  /** Current phase of the diagnosis session. */
  phase: DiagnosisPhase
  /** Concepts that failed in DIAGNOSE (need LEARN phase). */
  weakConcepts: Set<string>
  /** Concepts that were taught in LEARN (need PRACTICE). */
  taughtConcepts: Set<string>
  /** Concepts that passed PRACTICE (need VERIFY). */
  practicedConcepts: Set<string>
}

export interface BuildStateInput {
  sessionId: string
  userId: string
  documentId: string
  language: string
  concepts: Array<Concept & { dependencies?: ConceptDependency[] }>
  /** Optional restored state - used when the user resumes mid-diagnosis. */
  restored?: {
    states: Array<{
      conceptId: string
      mastery: number
      confidence: number
      attempts: number
      correct: number
      lastDelta: number | null
      lastSeen: Date | null
    }>
    questionsAsked: number
    clarificationCount: number
    recentDeltas: number[]
    globalConfidence: number
  }
}

/** Build a fresh in-memory state for a new session. */
export function buildInitialState(input: BuildStateInput): DiagnosisEngineState {
  const states = new Map<string, ConceptStateLocal>()
  for (const c of input.concepts) {
    const restored = input.restored?.states.find((s) => s.conceptId === c.id)
    if (restored) {
      states.set(c.externalId, {
        conceptId: c.id,
        mastery: restored.mastery,
        confidence: restored.confidence,
        attempts: restored.attempts,
        correct: restored.correct,
        density: priorFromState(restored.mastery, restored.confidence),
        lastDelta: restored.lastDelta,
        lastSeen: restored.lastSeen,
      })
    } else {
      states.set(c.externalId, {
        conceptId: c.id,
        mastery: 0.1,
        confidence: 0.0,
        attempts: 0,
        correct: 0,
        density: priorFromState(0.1, 0.0),
        lastDelta: null,
        lastSeen: null,
      })
    }
  }
  const idToExternal = new Map(input.concepts.map((c) => [c.id, c.externalId]))
  const edges: Array<{ from: string; to: string; weight: number }> = []
  for (const c of input.concepts) {
    if (!c.dependencies) continue
    for (const dep of c.dependencies) {
      const toExternal = idToExternal.get(dep.dependencyId)
      if (toExternal && toExternal !== c.externalId) {
        edges.push({ from: c.externalId, to: toExternal, weight: dep.weight })
      }
    }
  }
  const globalConfidence = computeGlobalConfidence(states, input.concepts)
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    documentId: input.documentId,
    language: input.language,
    concepts: input.concepts.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      title: c.title,
      summary: c.summary,
      importance: c.importance,
      difficulty: c.difficulty,
      chapter: c.chapter,
      topic: c.topic,
    })),
    edges,
    states,
    questionsAsked: input.restored?.questionsAsked ?? 0,
    clarificationCount: input.restored?.clarificationCount ?? 0,
    recentDeltas: input.restored?.recentDeltas ? [...input.restored.recentDeltas] : [],
    globalConfidence,
    pending: null,
    maxQuestions: MAX_QUESTIONS,
    selectedInBatch: new Set(),
    awaitingClarification: false,
    pendingClarification: null,
    phase: 'DIAGNOSE',
    weakConcepts: new Set(),
    taughtConcepts: new Set(),
    practicedConcepts: new Set(),
  }
}

/**
 * Pick the concept with the highest priority for the next question.
 * Priority = importance * (1 - confidence) * FisherInformation(θ, b=θ).
 *
 * Concepts already selected in the current batch (but not yet answered)
 * are skipped so that pre-generated questions cover multiple concepts.
 */
export function pickNextConcept(state: DiagnosisEngineState): {
  externalId: string
  state: ConceptStateLocal
  concept: DiagnosisEngineState['concepts'][number]
} | null {
  // Pre-compute dependency impact: how many concepts depend on each concept.
  const dependantCount = new Map<string, number>()
  let maxDependants = 1
  for (const e of state.edges) {
    const count = (dependantCount.get(e.to) ?? 0) + 1
    dependantCount.set(e.to, count)
    if (count > maxDependants) maxDependants = count
  }

  let best: {
    externalId: string
    state: ConceptStateLocal
    concept: DiagnosisEngineState['concepts'][number]
    score: number
  } | null = null
  for (const concept of state.concepts) {
    // Skip concepts already picked in this batch but not yet answered.
    if (state.selectedInBatch.has(concept.externalId)) continue
    const cs = state.states.get(concept.externalId)
    if (!cs) continue

    // Coverage: boost concepts that have never been probed.
    const coverage = cs.attempts === 0 ? 1.0 : 0.0

    // Uncertainty: lower confidence = higher priority.
    const uncertainty = 1 - cs.confidence

    // Dependency impact: concepts that many others depend on get a boost.
    const depCount = dependantCount.get(concept.externalId) ?? 0
    const dependencyImpact = depCount / maxDependants

    // Information gain: IRT Fisher information at current ability level.
    const theta = masteryToTheta(cs.mastery)
    const info = fisherInformation(theta, theta)

    // Recency bonus: concepts not seen recently get a nudge.
    const lastSeenMs = cs.lastSeen?.getTime() ?? 0
    const daysSinceLastSeen = lastSeenMs > 0 ? (Date.now() - lastSeenMs) / 86_400_000 : 999
    const recencyBonus = daysSinceLastSeen > 14 ? 0.3 : daysSinceLastSeen > 7 ? 0.15 : 0

    // Combined priority score.
    const score =
      0.35 * coverage +
      0.25 * concept.importance * uncertainty * info +
      0.2 * dependencyImpact +
      0.1 * concept.importance * (1 - cs.mastery) +
      0.1 * recencyBonus

    if (score <= 0) continue
    if (!best || score > best.score) {
      best = { externalId: concept.externalId, state: cs, concept, score }
    }
  }
  // Fallback: if all concepts are already selected in the batch, pick the
  // one with highest score anyway (degrades to old behaviour).
  if (!best) {
    for (const concept of state.concepts) {
      const cs = state.states.get(concept.externalId)
      if (!cs) continue
      const theta = masteryToTheta(cs.mastery)
      const info = fisherInformation(theta, theta)
      const score = concept.importance * (1 - cs.confidence) * info
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = { externalId: concept.externalId, state: cs, concept, score }
      }
    }
  }
  if (!best) return null
  return { externalId: best.externalId, state: best.state, concept: best.concept }
}

/** Decide EASY vs HARD based on concept difficulty and current mastery. */
export function pickQuestionKind(concept: { difficulty: number }, mastery: number): QuestionKind {
  // HARD when the concept is hard OR when mastery is already moderate and
  // we want to verify with a reasoning question.
  if (concept.difficulty >= 0.6 && mastery >= 0.35) return 'HARD'
  return 'EASY'
}

/** Pick a question kind given state, used by the engine. */
export function pickKindForState(
  state: DiagnosisEngineState,
  concept: DiagnosisEngineState['concepts'][number],
): QuestionKind {
  const cs = state.states.get(concept.externalId)
  return pickQuestionKind(concept, cs?.mastery ?? 0.1)
}

/**
 * Ask the LLM for the next question. Updates `state.pending` and
 * appends a `question` turn to the in-memory session.
 */
export async function askNext(
  state: DiagnosisEngineState,
): Promise<
  Result<
    { state: DiagnosisEngineState; question: DiagnosisQuestion; pending: PendingQuestion },
    BrainError
  >
> {
  const picked = pickNextConcept(state)
  if (!picked) {
    return Err({ kind: 'InvalidInput', message: 'No probeable concepts left.' })
  }
  // Track selection so batch generation doesn't repeat the same concept.
  state.selectedInBatch.add(picked.externalId)
  const kind = pickKindForState(state, picked.concept)
  console.error(
    `[askNext] concept="${picked.concept.title}" kind=${kind} mastery=${picked.state.mastery.toFixed(3)} confidence=${picked.state.confidence.toFixed(3)}`,
  )
  const promptId = kind === 'EASY' ? 'reason.diagnose.easy' : 'reason.diagnose.hard'
  const prompt = await loadPrompt(promptId)
  if (!prompt) {
    return Err({ kind: 'InvalidInput', message: `Prompt ${promptId} missing.` })
  }
  const session = getOrAttach(state)
  const user = prompt.render({
    concept: {
      title: picked.concept.title,
      summary: picked.concept.summary,
      chapter: picked.concept.chapter ?? '',
      topic: picked.concept.topic ?? '',
    },
    priorState: {
      mastery: picked.state.mastery.toFixed(3),
      confidence: picked.state.confidence.toFixed(3),
      attempts: picked.state.attempts,
    },
    history: turnWindow(session),
    language: state.language,
  })
  const schema = kind === 'EASY' ? DiagnoseEasySchema : DiagnoseHardSchema
  const result = await llmCallWithFallback({
    userId: state.userId,
    task: 'reason.diagnose',
    schema,
    buildUser: (previous) => (previous ? `${user}\n\n${repairHint(previous.error, kind)}` : user),
  })
  if (!result.ok) {
    console.error(`[askNext] LLM FAILED: ${JSON.stringify(result.error)}`)
    return result
  }
  console.error(`[askNext] LLM OK: provider=${result.value.providerId} model=${result.value.model}`)
  recordCallTokens(
    { userId: state.userId, task: 'reason.diagnose' },
    { provider: result.value.providerId, model: result.value.model },
    {
      text: '',
      tokensIn: result.value.tokensIn,
      tokensOut: result.value.tokensOut,
      model: result.value.model,
      provider: result.value.providerId,
    },
  )
  const question: DiagnosisQuestion =
    kind === 'EASY'
      ? ({
          kind: 'EASY',
          ...(result.value.value as {
            prompt: string
            options: string[]
            correctIndex: number
            difficulty: number
            microFeedback: string
          }),
        } as DiagnosisQuestion)
      : ({
          kind: 'HARD',
          ...(result.value.value as { prompt: string; difficulty: number; microFeedback: string }),
        } as DiagnosisQuestion)
  const pending: PendingQuestion = {
    conceptId: picked.concept.id,
    kind,
    question,
    tokensIn: result.value.tokensIn,
    tokensOut: result.value.tokensOut,
    providerId: result.value.providerId,
    model: result.value.model,
  }
  state.pending = pending
  pushTurn(session, {
    kind: 'question',
    at: new Date().toISOString(),
    conceptId: picked.concept.externalId,
    question,
  })
  return Ok({ state, question, pending })
}

/**
 * Generate a learn explanation for a weak concept.
 * Returns a teaching explanation, not a question.
 */
export async function askLearn(
  state: DiagnosisEngineState,
  externalId: string,
): Promise<
  Result<
    {
      state: DiagnosisEngineState
      explanation: string
      conceptTitle: string
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const concept = state.concepts.find((c) => c.externalId === externalId)
  if (!concept) return Err({ kind: 'InvalidInput', message: 'Concept not found.' })

  const prompt = await loadPrompt('reason.learn')
  if (!prompt) {
    // Fallback: use a simple explanation prompt
    const user = `Explaina este concepto de forma clara y concisa en ${state.language}. Concepto: ${concept.title}. Resumen: ${concept.summary}. Proporciona una explicación de 3-4 oraciones que un estudiante pueda entender fácilmente.`
    const result = await llmCallWithFallback({
      userId: state.userId,
      task: 'reason.diagnose',
      schema: LearnSchema,
      buildUser: () => user,
    })
    if (!result.ok) return result
    state.taughtConcepts.add(externalId)
    return Ok({
      state,
      explanation: result.value.value.explanation,
      conceptTitle: concept.title,
      tokensIn: result.value.tokensIn,
      tokensOut: result.value.tokensOut,
      providerId: result.value.providerId,
      model: result.value.model,
    })
  }

  const session = getOrAttach(state)
  const user = prompt.render({
    concept: {
      title: concept.title,
      summary: concept.summary,
      chapter: concept.chapter ?? '',
      topic: concept.topic ?? '',
    },
    language: state.language,
  })

  const result = await llmCallWithFallback({
    userId: state.userId,
    task: 'reason.diagnose',
    schema: LearnSchema,
    buildUser: () => user,
  })
  if (!result.ok) return result

  state.taughtConcepts.add(externalId)
  pushTurn(session, {
    kind: 'learn',
    at: new Date().toISOString(),
    conceptId: externalId,
    explanation: result.value.value.explanation,
  })

  return Ok({
    state,
    explanation: result.value.value.explanation,
    conceptTitle: concept.title,
    tokensIn: result.value.tokensIn,
    tokensOut: result.value.tokensOut,
    providerId: result.value.providerId,
    model: result.value.model,
  })
}

/**
 * Generate a batch of questions upfront so the client can serve them
 * instantly without waiting for an LLM call between each question.
 * Unlike the single-question path, this ignores allProbed/stagnant
 * stopping rules so the user gets the full question count.
 *
 * Questions are generated in parallel for speed - each concept is
 * pre-selected, then all LLM calls fire concurrently, and finally
 * state mutations are applied sequentially.
 */
export async function batchAskNext(
  state: DiagnosisEngineState,
  count: number,
): Promise<
  Result<
    {
      state: DiagnosisEngineState
      questions: { conceptId: string; question: DiagnosisQuestion; pending: PendingQuestion }[]
    },
    BrainError
  >
> {
  const selected: {
    picked: NonNullable<ReturnType<typeof pickNextConcept>>
    kind: QuestionKind
    promptId: string
    prompt: string
    schema: z.ZodTypeAny
  }[] = []

  for (let i = 0; i < count; i++) {
    const picked = pickNextConcept(state)
    if (!picked) break
    state.selectedInBatch.add(picked.externalId)
    const kind = pickKindForState(state, picked.concept)
    const promptId = kind === 'EASY' ? 'reason.diagnose.easy' : 'reason.diagnose.hard'
    const prompt = await loadPrompt(promptId)
    if (!prompt) break
    const session = getOrAttach(state)
    const user = prompt.render({
      concept: {
        title: picked.concept.title,
        summary: picked.concept.summary,
        chapter: picked.concept.chapter ?? '',
        topic: picked.concept.topic ?? '',
      },
      priorState: {
        mastery: picked.state.mastery.toFixed(3),
        confidence: picked.state.confidence.toFixed(3),
        attempts: picked.state.attempts,
      },
      history: turnWindow(session),
      language: state.language,
    })
    selected.push({
      picked,
      kind,
      promptId,
      prompt: user,
      schema: kind === 'EASY' ? DiagnoseEasySchema : DiagnoseHardSchema,
    })
  }

  if (selected.length === 0) {
    return Err({ kind: 'InvalidInput', message: 'No probeable concepts left.' })
  }

  const llmResults = await Promise.allSettled(
    selected.map((s) =>
      llmCallWithFallback({
        userId: state.userId,
        task: 'reason.diagnose',
        schema: s.schema,
        buildUser: (previous) =>
          previous ? `${s.prompt}\n\n${repairHint(previous.error, s.kind)}` : s.prompt,
      }),
    ),
  )

  const questions: { conceptId: string; question: DiagnosisQuestion; pending: PendingQuestion }[] =
    []
  let firstError: BrainError | null = null

  for (let i = 0; i < llmResults.length; i++) {
    const r = llmResults[i]!
    const s = selected[i]!
    if (r.status === 'rejected') {
      if (!firstError)
        firstError = { kind: 'ProviderError', provider: 'zen', message: String(r.reason) }
      continue
    }
    const result = r.value
    if (!result.ok) {
      if (!firstError) firstError = result.error
      continue
    }
    recordCallTokens(
      { userId: state.userId, task: 'reason.diagnose' },
      { provider: result.value.providerId, model: result.value.model },
      {
        text: '',
        tokensIn: result.value.tokensIn,
        tokensOut: result.value.tokensOut,
        model: result.value.model,
        provider: result.value.providerId,
      },
    )
    const question: DiagnosisQuestion =
      s.kind === 'EASY'
        ? {
            kind: 'EASY',
            prompt: result.value.value.prompt,
            difficulty: result.value.value.difficulty,
            options: result.value.value.options,
            correctIndex: result.value.value.correctIndex,
            microFeedback: result.value.value.microFeedback,
          }
        : {
            kind: 'HARD',
            prompt: result.value.value.prompt,
            difficulty: result.value.value.difficulty,
            microFeedback: result.value.value.microFeedback,
          }
    const pending: PendingQuestion = {
      conceptId: s.picked.concept.id,
      kind: s.kind,
      question,
      tokensIn: result.value.tokensIn,
      tokensOut: result.value.tokensOut,
      providerId: result.value.providerId,
      model: result.value.model,
    }
    state.pending = pending
    const session = getOrAttach(state)
    pushTurn(session, {
      kind: 'question',
      at: new Date().toISOString(),
      conceptId: s.picked.externalId,
      question,
    })
    questions.push({ conceptId: s.picked.externalId, question, pending })
  }

  if (questions.length === 0 && firstError) {
    return Err(firstError)
  }
  return Ok({ state, questions })
}

export interface SubmitOutput {
  state: DiagnosisEngineState
  evaluation: Evaluation
  correctness: number
  shouldStop: boolean
  stopReason: StopReason | null
  microFeedback: string
  tokensIn: number
  tokensOut: number
  providerId: string
  model: string
  /** A clarification is offered when evaluation lands in the ambiguous band
   *  and we still have headroom (≤1 per question, ≤3 per session). */
  clarification: Clarification | null
}

export type StopReason =
  | 'max-questions'
  | 'global-confidence'
  | 'stagnant'
  | 'all-probed'
  | 'coverage'
  | 'clarification-budget'
  | 'user-finalize'

/**
 * Score the pending answer, apply the Bayesian update, propagate to
 * neighbors, and check the stopping rule.
 *
 * The flow:
 *   1. Resolve the raw `correctness` for IDONTKNOW / SKIP / MCQ.
 *   2. For OPEN: call the LLM to grade.
 *   3. Update the concept's density and (mastery, confidence).
 *   4. Propagate a fraction of the delta to dependency edges.
 *   5. Optionally trigger a clarification if the band matches and
 *      we have headroom.
 *   6. Check stopping rules.
 */
export async function scoreAnswer(
  state: DiagnosisEngineState,
  answer: AnswerInput,
): Promise<Result<SubmitOutput, BrainError>> {
  if (!state.pending) {
    return Err({ kind: 'InvalidInput', message: 'No pending question to answer.' })
  }
  const pending = state.pending
  const conceptExternal = state.concepts.find(
    (c) => c.id === pending.conceptId || c.externalId === pending.conceptId,
  )?.externalId
  if (!conceptExternal) {
    return Err({ kind: 'InvalidInput', message: 'Pending question references a missing concept.' })
  }
  const session = getOrAttach(state)
  pushTurn(session, {
    kind: 'answer',
    at: new Date().toISOString(),
    conceptId: conceptExternal,
    answer,
  })
  const cs = state.states.get(conceptExternal)
  if (!cs) return Err({ kind: 'InvalidInput', message: 'Concept state not found.' })

  // 1. Resolve raw correctness.
  let direct: { correctness: number; rationale: string; microFeedback: string } | null = null
  let evaluated: Evaluation | null = null
  let tokensIn = 0
  let tokensOut = 0
  let providerId: string = 'zen'
  let model = 'deepseek-v4-flash'

  if (answer.kind === 'MCQ' && pending.kind === 'EASY') {
    const easy = pending.question
    if (easy.kind !== 'EASY') {
      return Err({ kind: 'InvalidInput', message: 'MCQ answer against non-MCQ question.' })
    }
    const correct = answer.optionIndex === easy.correctIndex
    direct = {
      correctness: correct ? 1.0 : 0.0,
      rationale: correct ? 'Correct option.' : 'Wrong option.',
      microFeedback: correct
        ? 'Yes, that is the one.'
        : 'Not quite - we will come back to this one.',
    }
  } else if (answer.kind === 'IDONTKNOW') {
    direct = {
      correctness: 0,
      rationale: 'Learner indicated they do not know.',
      microFeedback: 'Honest - that helps us know where to focus.',
    }
  } else if (answer.kind === 'SKIP') {
    direct = {
      correctness: cs.mastery,
      rationale: 'Skipped - no signal on mastery, only a confidence drop.',
      microFeedback: 'Skipped.',
    }
  } else if (answer.kind === 'OPEN' && pending.kind === 'HARD') {
    const concept = state.concepts.find((c) => c.externalId === conceptExternal)!
    const ev = await evaluateOpenAnswer(state, pending.question.prompt, answer.text, {
      title: concept.title,
      summary: concept.summary,
    })
    if (!ev.ok) return ev
    evaluated = ev.value.evaluation
    tokensIn = ev.value.tokensIn
    tokensOut = ev.value.tokensOut
    providerId = ev.value.providerId
    model = ev.value.model
  } else {
    return Err({ kind: 'InvalidInput', message: 'Answer kind does not match question kind.' })
  }

  // 2. Apply Bayesian update.
  const correctness = direct?.correctness ?? evaluated!.correctness
  const newDensity =
    answer.kind === 'IDONTKNOW'
      ? updateWithIDontKnow(cs.density, pending.question.difficulty)
      : answer.kind === 'SKIP'
        ? updateWithSkip(cs.density)
        : updateWithEvidence(cs.density, correctness, pending.question.difficulty)
  const post = moments(newDensity)
  const prevMastery = cs.mastery
  cs.density = newDensity
  cs.mastery = post.mastery
  cs.confidence = post.confidence
  cs.attempts += 1
  if (answer.kind !== 'SKIP') cs.correct += correctness >= 0.7 ? 1 : 0
  cs.lastDelta = post.mastery - prevMastery
  cs.lastSeen = new Date()

  // 3. Neighbor propagation.
  propagateToNeighbors(state, conceptExternal, cs.lastDelta)

  // 4. Update session-level state.
  state.questionsAsked += 1
  state.recentDeltas.push(Math.abs(cs.lastDelta))
  if (state.recentDeltas.length > STOP_STAGNANT_RUNS) state.recentDeltas.shift()
  state.globalConfidence = computeGlobalConfidence(state.states, state.concepts)
  pushTurn(session, {
    kind: 'feedback',
    at: new Date().toISOString(),
    conceptId: conceptExternal,
    evaluation: evaluated ?? toEval(direct!),
    microFeedback: direct?.microFeedback ?? evaluated!.microFeedback,
  })

  // 5. Optional clarification.
  let clarification: Clarification | null = null
  if (
    evaluated &&
    state.awaitingClarification === false &&
    correctness >= CLARIFY_LO &&
    correctness <= CLARIFY_HI &&
    state.clarificationCount < CLARIFY_PER_SESSION_MAX &&
    (session.turns.filter((t) => t.kind === 'clarification').length < CLARIFY_PER_QUESTION_MAX ||
      countClarificationsForQuestion(session, pending.conceptId) < CLARIFY_PER_QUESTION_MAX)
  ) {
    const clar = await generateClarification(state, pending, evaluated, answer)
    if (clar.ok && clar.value) {
      clarification = clar.value
      state.clarificationCount += 1
      state.pendingClarification = clarification
      state.awaitingClarification = true
      pushTurn(session, {
        kind: 'clarification',
        at: new Date().toISOString(),
        conceptId: conceptExternal,
        text: clarification.clarification,
        microFeedback: clarification.microFeedback,
      })
    }
  }

  // 6. Stopping rule.
  state.pending = null
  // Reset batch tracking so the next batch (or single question) can
  // pick from all concepts again with updated Bayesian scores.
  state.selectedInBatch.clear()
  const stop = shouldStop(state)
  const stopReason = stop ? detectStopReason(state) : null
  return Ok({
    state,
    evaluation: evaluated ?? toEval(direct!),
    correctness,
    shouldStop: stop,
    stopReason,
    microFeedback: direct?.microFeedback ?? evaluated!.microFeedback,
    tokensIn,
    tokensOut,
    providerId,
    model,
    clarification,
  })
}

/** Whether the session should terminate now. */
export function shouldStop(state: DiagnosisEngineState): boolean {
  // Never stop during LEARN or PRACTICE phases - those are teaching phases.
  if (state.phase === 'LEARN' || state.phase === 'PRACTICE') return false

  // In VERIFY phase, stop when all verified concepts are solid.
  if (state.phase === 'VERIFY') {
    if (state.questionsAsked >= state.maxQuestions) return true
    if (state.globalConfidence >= STOP_GLOBAL_CONFIDENCE) return true
    return false
  }

  // DIAGNOSE phase: smart stop conditions.
  const asked = state.questionsAsked

  // Hard minimum: never stop before 8 questions.
  if (asked < 8) return false

  // Hard maximum: always stop at 35.
  if (asked >= 35) return true

  // Global confidence threshold: most concepts are well-understood.
  if (state.globalConfidence >= STOP_GLOBAL_CONFIDENCE) return true

  // Stagnation: mastery is barely moving despite continued questions.
  if (state.recentDeltas.length >= STOP_STAGNANT_RUNS) {
    const allSmall = state.recentDeltas.every((d) => d < STOP_DELTA_THRESHOLD)
    if (allSmall && asked >= 12) return true
  }

  // Coverage: all important concepts have been probed with sufficient evidence.
  if (allProbed(state)) return true

  // Adaptive: after target (20), check if remaining concepts have low value.
  if (asked >= 20) {
    let uncoveredImportance = 0
    let totalImportance = 0
    for (const c of state.concepts) {
      totalImportance += c.importance
      const cs = state.states.get(c.externalId)
      if (!cs || cs.attempts === 0 || cs.confidence < 0.6) {
        uncoveredImportance += c.importance
      }
    }
    // If less than 15% of total importance is uncovered, we're done.
    if (totalImportance > 0 && uncoveredImportance / totalImportance < 0.15) return true
  }

  return false
}

function detectStopReason(state: DiagnosisEngineState): StopReason {
  const asked = state.questionsAsked
  if (asked < 8) return 'user-finalize'
  if (asked >= 35) return 'max-questions'
  if (state.globalConfidence >= STOP_GLOBAL_CONFIDENCE) return 'global-confidence'
  if (state.recentDeltas.length >= STOP_STAGNANT_RUNS) {
    const allSmall = state.recentDeltas.every((d) => d < STOP_DELTA_THRESHOLD)
    if (allSmall && asked >= 12) return 'stagnant'
  }
  if (allProbed(state)) return 'all-probed'
  if (asked >= 20) return 'coverage'
  return 'user-finalize'
}

function allProbed(state: DiagnosisEngineState): boolean {
  for (const c of state.concepts) {
    const cs = state.states.get(c.externalId)
    if (!cs) continue
    if (cs.attempts === 0) return false
    if (cs.confidence < 0.85) return false
  }
  return true
}

/**
 * Identify weak concepts after DIAGNOSE phase.
 * Returns externalIds of concepts that need teaching.
 */
export function identifyWeakConcepts(state: DiagnosisEngineState): string[] {
  const weak: string[] = []
  for (const c of state.concepts) {
    const cs = state.states.get(c.externalId)
    if (!cs) continue
    // Weak if: never attempted, low mastery, or low confidence.
    if (cs.attempts === 0 || cs.mastery < 0.4 || cs.confidence < 0.5) {
      weak.push(c.externalId)
    }
  }
  // Sort by importance × weakness (most important weak concepts first).
  weak.sort((a, b) => {
    const ca = state.concepts.find((c) => c.externalId === a)!
    const cb = state.concepts.find((c) => c.externalId === b)!
    const sa = state.states.get(a)!
    const sb = state.states.get(b)!
    const scoreA = ca.importance * (1 - sa.mastery) * (1 - sa.confidence)
    const scoreB = cb.importance * (1 - sb.mastery) * (1 - sb.confidence)
    return scoreB - scoreA
  })
  return weak
}

/**
 * Transition from DIAGNOSE to LEARN phase.
 * Populates weakConcepts and sets phase to LEARN.
 */
export function transitionToLearn(state: DiagnosisEngineState): void {
  const weak = identifyWeakConcepts(state)
  state.weakConcepts = new Set(weak)
  state.phase = 'LEARN'
}

/**
 * Transition from LEARN to PRACTICE phase.
 */
export function transitionToPractice(state: DiagnosisEngineState): void {
  state.phase = 'PRACTICE'
}

/**
 * Transition from PRACTICE to VERIFY phase.
 * Marks all practiced concepts as needing verification.
 */
export function transitionToVerify(state: DiagnosisEngineState): void {
  state.phase = 'VERIFY'
}

/**
 * Get the next weak concept to teach in LEARN phase.
 * Returns null if all weak concepts have been taught.
 */
export function getNextWeakConcept(state: DiagnosisEngineState): {
  externalId: string
  concept: DiagnosisEngineState['concepts'][number]
} | null {
  for (const externalId of state.weakConcepts) {
    if (state.taughtConcepts.has(externalId)) continue
    const concept = state.concepts.find((c) => c.externalId === externalId)
    if (!concept) continue
    return { externalId, concept }
  }
  return null
}

/**
 * Get the next concept to practice in PRACTICE phase.
 */
export function getNextPracticeConcept(state: DiagnosisEngineState): {
  externalId: string
  concept: DiagnosisEngineState['concepts'][number]
} | null {
  for (const externalId of state.weakConcepts) {
    if (state.practicedConcepts.has(externalId)) continue
    const concept = state.concepts.find((c) => c.externalId === externalId)
    if (!concept) continue
    return { externalId, concept }
  }
  return null
}

/**
 * Resolve a clarification follow-up answer. The user already answered the
 * hard question; their follow-up message replaces the original text and
 * we re-evaluate. This avoids breaking the "one question, one score"
 * invariant of the Bayesian engine.
 */
export async function resolveClarification(
  state: DiagnosisEngineState,
  followUp: string,
): Promise<
  Result<
    {
      state: DiagnosisEngineState
      evaluation: Evaluation
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  if (!state.awaitingClarification || !state.pendingClarification) {
    return Err({ kind: 'InvalidInput', message: 'No clarification pending.' })
  }
  // The clarification was about the most recent question, whose concept
  // we can look up from the last "question" turn.
  const session = getOrAttach(state)
  const lastQ = [...session.turns].reverse().find((t) => t.kind === 'question')
  if (!lastQ || !lastQ.conceptId) {
    return Err({
      kind: 'InvalidInput',
      message: 'Cannot resolve clarification: prior question missing.',
    })
  }
  const conceptExternal = lastQ.conceptId
  const concept = state.concepts.find((c) => c.externalId === conceptExternal)
  if (!concept) {
    return Err({ kind: 'InvalidInput', message: 'Cannot resolve clarification: concept missing.' })
  }
  const ev = await evaluateOpenAnswer(state, state.pendingClarification.clarification, followUp, {
    title: concept.title,
    summary: concept.summary,
  })
  if (!ev.ok) return ev
  const cs = state.states.get(conceptExternal)
  if (!cs) return Err({ kind: 'InvalidInput', message: 'Concept state missing.' })
  const newDensity = updateWithEvidence(cs.density, ev.value.evaluation.correctness, 0)
  const post = moments(newDensity)
  cs.density = newDensity
  cs.mastery = post.mastery
  cs.confidence = post.confidence
  state.globalConfidence = computeGlobalConfidence(state.states, state.concepts)
  state.awaitingClarification = false
  state.pendingClarification = null
  pushTurn(session, {
    kind: 'answer',
    at: new Date().toISOString(),
    conceptId: conceptExternal,
    answer: { kind: 'OPEN', text: followUp },
  })
  pushTurn(session, {
    kind: 'feedback',
    at: new Date().toISOString(),
    conceptId: conceptExternal,
    evaluation: ev.value.evaluation,
    microFeedback: ev.value.evaluation.microFeedback,
  })
  return Ok({
    state,
    evaluation: ev.value.evaluation,
    tokensIn: ev.value.tokensIn,
    tokensOut: ev.value.tokensOut,
    providerId: ev.value.providerId,
    model: ev.value.model,
  })
}

// ─── Internal helpers ──────────────────────────────────────────────────

function toEval(d: { correctness: number; rationale: string; microFeedback: string }): Evaluation {
  return {
    correctness: d.correctness,
    isCorrect: d.correctness >= 0.7,
    rationale: d.rationale,
    microFeedback: d.microFeedback,
  }
}

function propagateToNeighbors(
  state: DiagnosisEngineState,
  externalId: string,
  delta: number,
): void {
  if (Math.abs(delta) < 1e-6) return
  // Edge direction: { from: dependant, to: dependency }.
  // When concept C improves, propagate to concepts that depend on C
  // (i.e., concepts whose edges point TO C).
  for (const e of state.edges) {
    if (e.to !== externalId) continue
    const cs = state.states.get(e.from)
    if (!cs) continue
    // "from depends on to" - if the dependency improved, the dependant
    // probably knows too.
    const inferred = 0.3 * delta * e.weight
    if (Math.abs(inferred) < 1e-6) continue
    const newDensity = updateWithEvidence(
      cs.density,
      inferred > 0 ? 1 : 0,
      masteryToTheta(cs.mastery),
    )
    const post = moments(newDensity)
    cs.density = newDensity
    cs.mastery = clamp01(post.mastery)
    cs.confidence = clamp01(post.confidence - 0.1)
  }
}

function computeGlobalConfidence(
  states: Map<string, ConceptStateLocal>,
  concepts: Array<{ externalId: string; importance: number }>,
): number {
  if (concepts.length === 0) return 0
  let weighted = 0
  let totalWeight = 0
  for (const c of concepts) {
    const cs = states.get(c.externalId)
    if (!cs) continue
    weighted += c.importance * cs.confidence
    totalWeight += c.importance
  }
  if (totalWeight <= 0) return 0
  return clamp01(weighted / totalWeight)
}

function getOrAttach(state: DiagnosisEngineState): ActiveSession {
  const existing = getSession(state.sessionId)
  if (existing) return existing
  const session: ActiveSession = {
    sessionId: state.sessionId,
    userId: state.userId,
    documentId: state.documentId,
    startedAt: Date.now(),
    turns: [],
    notes: new Map(),
  }
  registerSession(session)
  return session
}

function pushTurn(session: ActiveSession, turn: SessionTurn): void {
  session.turns.push(turn)
}

function countClarificationsForQuestion(session: ActiveSession, _conceptId: string): number {
  // Conservative: count all clarifications seen so far. The simpler rule
  // - cap at 1 per question - is enforced by the caller checking
  // `state.clarificationCount` against the per-session max instead.
  return session.turns.filter((t) => t.kind === 'clarification').length
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function repairHint(error: string, kind: QuestionKind): string {
  if (kind === 'EASY') {
    return `IMPORTANT: Your previous response did not match the schema. Error: ${error}\nReturn ONLY a JSON object with exactly 4 string options and an integer correctIndex in 0..3.`
  }
  return `IMPORTANT: Your previous response did not match the schema. Error: ${error}\nReturn ONLY a JSON object with a single "prompt" string and a "difficulty" number in [-3, 3]. No "options" or "correctIndex".`
}

async function evaluateOpenAnswer(
  state: DiagnosisEngineState,
  questionText: string,
  answerText: string,
  concept: { title: string; summary: string },
): Promise<
  Result<
    {
      evaluation: Evaluation
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const prompt = await loadPrompt('reason.evaluate')
  if (!prompt) {
    return Err({ kind: 'InvalidInput', message: 'Prompt reason.evaluate missing.' })
  }
  const user = prompt.render({
    concept,
    question: questionText,
    answer: answerText,
    language: state.language,
  })
  const result = await llmCallWithFallback({
    userId: state.userId,
    task: 'reason.evaluate',
    schema: EvaluationSchema,
    buildUser: (previous) =>
      previous ? `${user}\n\nIMPORTANT: ${previous.error}\nReturn ONLY the JSON object.` : user,
  })
  if (!result.ok) return result
  recordCallTokens(
    { userId: state.userId, task: 'reason.evaluate' },
    { provider: result.value.providerId, model: result.value.model },
    {
      text: '',
      tokensIn: result.value.tokensIn,
      tokensOut: result.value.tokensOut,
      model: result.value.model,
      provider: result.value.providerId,
    },
  )
  return Ok({
    evaluation: result.value.value,
    tokensIn: result.value.tokensIn,
    tokensOut: result.value.tokensOut,
    providerId: result.value.providerId,
    model: result.value.model,
  })
}

export async function generateClarification(
  state: DiagnosisEngineState,
  pending: PendingQuestion,
  evaluation: Evaluation,
  answer: AnswerInput,
): Promise<Result<Clarification | null, BrainError>> {
  const prompt = await loadPrompt('reason.clarify')
  if (!prompt) {
    return Err({ kind: 'InvalidInput', message: 'Prompt reason.clarify missing.' })
  }
  const concept = state.concepts.find(
    (c) => c.id === pending.conceptId || c.externalId === pending.conceptId,
  )
  if (!concept) return Err({ kind: 'InvalidInput', message: 'Concept missing.' })
  const user = prompt.render({
    concept: { title: concept.title, summary: concept.summary },
    question: pending.question.prompt,
    answer: answer.kind === 'OPEN' ? answer.text : `(answer: ${answer.kind})`,
    language: state.language,
  })
  const result = await llmCallWithFallback({
    userId: state.userId,
    task: 'reason.clarify',
    schema: ClarificationSchema,
    buildUser: (previous) => (previous ? `${user}\n\nIMPORTANT: ${previous.error}` : user),
  })
  if (!result.ok) return result
  recordCallTokens(
    { userId: state.userId, task: 'reason.clarify' },
    { provider: result.value.providerId, model: result.value.model },
    {
      text: '',
      tokensIn: result.value.tokensIn,
      tokensOut: result.value.tokensOut,
      model: result.value.model,
      provider: result.value.providerId,
    },
  )
  void evaluation
  return Ok(result.value.value)
}

/** Convenience export for tests: build a state from a parsed document and
 *  a list of concept rows. The wiring for this lives in
 *  `apps/web/features/diagnosis`. */
export function defaultLanguageFor(doc: ParsedDocument): string {
  return doc.language ?? 'en'
}

/**
 * LLM call with provider-fallback. Picks a provider+model via the
 * router, calls `withSchemaRepair` for validation retries, and on a
 * hard provider error (402, 404, 401) marks that provider bad and
 * walks to the next candidate.
 *
 * This is the engine's only place that knows about the provider
 * surface; the rest of the engine sees a successful ChatResponse.
 */
async function llmCallWithFallback<S extends z.ZodTypeAny>(opts: {
  userId: string
  task: TaskType
  schema: S
  buildUser: (previous: { raw: string; error: string } | null) => string
}): Promise<
  Result<
    {
      value: z.infer<S>
      tokensIn: number
      tokensOut: number
      providerId: ChatResponse['provider']
      model: string
    },
    BrainError
  >
> {
  // Try up to N candidates (one per provider+model pair in the policy
  // list). Each attempt uses the same schema-repair loop.
  const ctx = { userId: opts.userId, task: opts.task }
  const MAX_CANDIDATES = 4
  let lastErr: BrainError | null = null
  for (let attempt = 0; attempt < MAX_CANDIDATES; attempt += 1) {
    const picked = pickRouteWithProvider(ctx)
    if (!picked.ok) {
      if (lastErr) return Err(lastErr)
      return Err(picked.error)
    }
    if (isCandidateBad(picked.value.decision.provider, picked.value.decision.model)) continue
    const result = await withSchemaRepair({
      provider: picked.value.provider,
      task: opts.task,
      schema: opts.schema,
      buildRequest: (previous) => ({
        user: opts.buildUser(previous),
        model: picked.value.decision.model,
        ...(picked.value.decision.temperature !== undefined
          ? { temperature: picked.value.decision.temperature }
          : {}),
        ...(picked.value.decision.maxTokens !== undefined
          ? { maxTokens: picked.value.decision.maxTokens }
          : {}),
        jsonMode: true,
      }),
    })
    if (result.ok) {
      recordCallTokens(ctx, picked.value.decision, {
        text: '',
        tokensIn: result.value.tokensIn,
        tokensOut: result.value.tokensOut,
        model: result.value.model,
        provider: result.value.providerId,
      })
      return Ok({
        value: result.value.value,
        tokensIn: result.value.tokensIn,
        tokensOut: result.value.tokensOut,
        providerId: result.value.providerId,
        model: result.value.model,
      })
    }
    console.error(
      `[llmCallWithFallback] attempt=${attempt} provider=${picked.value.decision.provider} model=${picked.value.decision.model} error=${JSON.stringify(result.error)}`,
    )
    if (result.error.kind === 'SchemaFailure') {
      markProviderBad(picked.value.decision.provider, picked.value.decision.model)
      lastErr = result.error
      continue
    }
    // Provider error: mark this exact (provider, model) bad so the
    // next call skips it but still tries the model's free twin (or
    // a different provider) on the same plan.
    markProviderBad(picked.value.decision.provider, picked.value.decision.model)
    lastErr = result.error
  }
  if (lastErr) return Err(lastErr)
  return Err({ kind: 'BudgetExceeded', userId: opts.userId })
}
