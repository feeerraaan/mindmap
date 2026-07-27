/**
 * Brain — public API.
 *
 * The only package that may import an AI SDK or call any LLM endpoint.
 * Other packages and apps consume `Brain.knowledge.buildGraph()` and friends
 * without knowing which provider sits behind the router.
 */
import { Ok, type Result, type SseEvent } from '@mindmap/shared'
import type { BrainError, ParsedDocument } from '@mindmap/types'
import {
  buildGraph,
  type KnowledgeBuildContext,
  type KnowledgeBuildOutput,
} from './engines/knowledge-engine'
import {
  getProvider,
  listProviders,
  setProviderRegistry,
  resetProviderRegistry,
} from './providers/registry'
import { mockProvider, type MockScript, type MockProviderOptions } from './providers/mock'
import {
  tryConsume,
  resetBucket,
  budgetFor,
  getBudgetState,
  hasBudget,
  recordUsage,
  resetBudgets,
  type RouteContext,
  type RouteDecision,
  type Candidate,
  type TokenBucketOptions,
  type BudgetState,
} from './router'
import {
  ClassifyLanguageSchema,
  ExtractMetadataSchema,
  ExtractRelationshipsSchema,
  ExtractStructureSchema,
  ConceptSummarySchema,
  ChapterOutlineSchema,
  TopicOutlineSchema,
  ExtractMetadataItemSchema,
  extractJson,
} from './schemas/knowledge'
import {
  DiagnoseEasySchema,
  DiagnoseHardSchema,
  EvaluationSchema,
  ClarificationSchema,
  type AnswerInput,
  type Clarification,
  type DiagnosisQuestion,
  type Evaluation,
} from './schemas/diagnosis'
import { validateAcyclic, type CycleReport } from './engines/dag'
import {
  withSchemaRepair,
  withBackoff,
  type SchemaRepairOptions,
  type SchemaRepairResult,
} from './retry'
import type { ChatMessage, ChatRequest, ChatResponse, ProviderAdapter } from './providers/provider'
import { ProviderError, ProviderMissingKey, ProviderRateLimited } from './providers/provider'
import { zenAdapter } from './providers/zen'
import { goAdapter } from './providers/go'
import { openAiCompatibleAdapter, type OpenAICompatibleEnv } from './providers/openai-compatible'
import { loadPrompt, loadAllPrompts, _resetPromptCache } from '@mindmap/prompts'
import type { LoadedPrompt, PromptFrontmatter } from '@mindmap/prompts'
import {
  buildInitialState,
  askNext,
  batchAskNext,
  scoreAnswer,
  shouldStop,
  pickNextConcept,
  pickKindForState,
  resolveClarification as _applyClarification,
  type BuildStateInput,
  type DiagnosisEngineState,
  type PendingQuestion,
  type StopReason,
  type SubmitOutput,
  type QuestionKind,
  type ConceptStateLocal,
  MAX_QUESTIONS,
  STOP_GLOBAL_CONFIDENCE,
  STOP_DELTA_THRESHOLD,
  STOP_STAGNANT_RUNS,
} from './engines/evaluation-engine'
import { streamClarification, type ClarificationToken } from './engines/conversation-engine'
import {
  scheduleReviews as _scheduleReviews,
  intervalDays,
  priorityFor,
  reasonFor,
  dayKey,
  dayLabel,
  isDueToday,
  isOverdue,
  MAX_ITEMS_PER_DAY,
  DEFAULT_HORIZON_DAYS,
  type ScheduleInput,
  type ScheduleOutput,
  type TimelineConceptInput,
  type ReviewReason,
} from './engines/timeline-engine'
import {
  remember as _remember,
  recall as _recall,
  dropUserMemory as _dropUserMemory,
  getSession as _getSession,
  dropSession as _dropSession,
  turnWindow as _turnWindow,
} from './engines/memory'
import {
  fisherInformation,
  masteryToTheta,
  thetaToMastery,
  probabilityCorrect,
} from './engines/irt'
import {
  moments as _densityMoments,
  priorFromState as _priorFromState,
  uniformPrior as _uniformPrior,
  updateWithEvidence as _updateWithEvidence,
  updateWithIDontKnow as _updateWithIDontKnow,
  updateWithSkip as _updateWithSkip,
  type Density,
} from './engines/bayesian'

export interface KnowledgeBuildInput {
  document: ParsedDocument
  userId: string
  onProgress?: (fraction: number, stage: string) => void
}

export interface DiagnosisEvent extends SseEvent {
  event: 'question' | 'microfeedback' | 'state' | 'complete' | 'error'
}

export interface DiagnosisState {
  state: DiagnosisEngineState
  shouldStop: boolean
  stopReason: StopReason | null
}

export const Brain = {
  knowledge: {
    async buildGraph(
      input: KnowledgeBuildInput,
    ): Promise<Result<KnowledgeBuildOutput, BrainError>> {
      const ctx: KnowledgeBuildContext = {
        userId: input.userId,
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
      }
      return buildGraph(input.document, ctx)
    },
  },
  evaluation: {
    /**
     * Build a fresh in-memory state for a new (or resumed) session. The
     * caller persists the state to `DiagnosisSession` and `ConceptState`.
     */
    buildState(input: BuildStateInput): DiagnosisEngineState {
      return buildInitialState(input)
    },
    shouldStop,
    MAX_QUESTIONS,
    STOP_GLOBAL_CONFIDENCE,
    STOP_DELTA_THRESHOLD,
    STOP_STAGNANT_RUNS,
    /**
     * Ask the LLM for the next question. Returns the question text,
     * the engine state (with `pending` set), and the tokens used.
     */
    async askNext(
      state: DiagnosisEngineState,
    ): Promise<
      Result<
        { state: DiagnosisEngineState; question: DiagnosisQuestion; pending: PendingQuestion },
        BrainError
      >
    > {
      return askNext(state)
    },
    /**
     * Generate a batch of questions upfront so the client can serve them
     * instantly without waiting for an LLM call between each question.
     */
    async batchAskNext(
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
      return batchAskNext(state, count)
    },
    /**
     * Score the user's answer. Returns the updated state, the
     * evaluation, the per-question micro-feedback, and — when the
     * engine stopped — the reason.
     */
    async score(
      state: DiagnosisEngineState,
      answer: AnswerInput,
    ): Promise<Result<SubmitOutput, BrainError>> {
      return scoreAnswer(state, answer)
    },
    /** Apply a Socratic clarification follow-up. */
    async applyClarification(
      state: DiagnosisEngineState,
      followUp: string,
    ): Promise<Result<{ state: DiagnosisEngineState; evaluation: Evaluation }, BrainError>> {
      return _applyClarification(state, followUp)
    },
    /** Pick the next concept (no LLM call). For tests / introspection. */
    pickNext(
      state: DiagnosisEngineState,
    ): { externalId: string; concept: DiagnosisEngineState['concepts'][number] } | null {
      const p = pickNextConcept(state)
      if (!p) return null
      return { externalId: p.externalId, concept: p.concept }
    },
    pickKind(
      state: DiagnosisEngineState,
      concept: DiagnosisEngineState['concepts'][number],
    ): QuestionKind {
      return pickKindForState(state, concept)
    },
  },
  conversation: {
    /** Stream the Socratic clarification question for an ambiguous answer. */
    streamClarification(
      state: DiagnosisEngineState,
      pending: PendingQuestion,
      evaluation: Evaluation,
      answer: AnswerInput,
    ): AsyncIterable<ClarificationToken> {
      return streamClarification(state, pending, evaluation, answer)
    },
  },
  timeline: {
    /**
     * Build (or rebuild) a `ReviewPlan` for a document, given the user's
     * current `ConceptState` rows. Pure: returns the shape; the caller
     * persists it. The engine is local math — no LLM.
     */
    scheduleReviews(input: {
      documentId: string
      now?: Date
      horizonDays?: number
      examDate?: Date
      concepts: Array<{
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
      }>
    }): Result<
      {
        sessions: Array<{
          scheduledFor: Date
          items: Array<{
            conceptId: string
            priority: number
            reason: string
            title: string
            chapter: string | null
            topic: string | null
            mastery: number
            confidence: number
            importance: number
          }>
        }>
        diagnostics: {
          totalConcepts: number
          scheduledConcepts: number
          droppedConcepts: number
          horizonDays: number
        }
      },
      BrainError
    > {
      const out = _scheduleReviews(input)
      return Ok({
        sessions: out.sessions.map((s) => {
          const items = out.items
            .filter((it) => it.sessionId === s.id)
            .map((it) => {
              const cand = input.concepts.find((c) => c.conceptId === it.conceptId)
              return {
                conceptId: it.conceptId,
                priority: it.priority,
                reason: it.reason,
                title: cand?.title ?? '',
                chapter: cand?.chapter ?? null,
                topic: cand?.topic ?? null,
                mastery: cand?.state?.mastery ?? 0.1,
                confidence: cand?.state?.confidence ?? 0,
                importance: cand?.importance ?? 0.5,
              }
            })
          return { scheduledFor: s.scheduledFor, items }
        }),
        diagnostics: out.diagnostics,
      })
    },
    nextDue(_userId: string): Result<unknown, BrainError> {
      return Ok([])
    },
  },
  memory: {
    remember(userId: string, key: string, value: string): void {
      _remember(userId, key, value)
    },
    recall(userId: string, key: string): string | undefined {
      return _recall(userId, key)
    },
    dropUser(userId: string): void {
      _dropUserMemory(userId)
    },
  },
} as const

function _detectReason(state: DiagnosisEngineState): StopReason {
  if (state.questionsAsked >= state.maxQuestions) return 'max-questions'
  if (state.globalConfidence >= STOP_GLOBAL_CONFIDENCE) return 'global-confidence'
  if (state.recentDeltas.length >= STOP_STAGNANT_RUNS) {
    if (state.recentDeltas.every((d) => d < STOP_DELTA_THRESHOLD)) return 'stagnant'
  }
  return 'user-finalize'
}
void _detectReason

// ─── Public re-exports (lower-level) ──────────────────────────────
// Apps and tests may import these; nothing else in the repo should.

export { buildGraph, validateAcyclic }
export type { KnowledgeBuildContext, KnowledgeBuildOutput, CycleReport }

export type { RouteContext, RouteDecision, Candidate }

export { tryConsume, resetBucket, budgetFor, getBudgetState, hasBudget, recordUsage, resetBudgets }
export type { TokenBucketOptions, BudgetState }

export { getProvider, listProviders, setProviderRegistry, resetProviderRegistry, mockProvider }
export type { MockScript, MockProviderOptions }

export {
  zenAdapter,
  goAdapter,
  openAiCompatibleAdapter,
  ProviderError,
  ProviderMissingKey,
  ProviderRateLimited,
}
export type { ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, OpenAICompatibleEnv }

export { withSchemaRepair, withBackoff, extractJson }
export type { SchemaRepairOptions, SchemaRepairResult }

export { describeError, isBudgetExceeded, isRateLimited, isSchemaFailure } from './errors'
export { demoMockProvider, _demoCallCount } from './providers/demo-mock'

export {
  ClassifyLanguageSchema,
  ConceptSummarySchema,
  ExtractMetadataSchema,
  ExtractMetadataItemSchema,
  ExtractRelationshipsSchema,
  ExtractStructureSchema,
  ChapterOutlineSchema,
  TopicOutlineSchema,
  DiagnoseEasySchema,
  DiagnoseHardSchema,
  EvaluationSchema,
  ClarificationSchema,
}
export type { AnswerInput, Clarification, DiagnosisQuestion, Evaluation }

export { loadPrompt, loadAllPrompts, _resetPromptCache }
export type { LoadedPrompt, PromptFrontmatter }

// ─── Phase 5: diagnosis engine public surface ────────────────────
export {
  buildInitialState,
  askNext,
  scoreAnswer,
  shouldStop,
  pickNextConcept,
  pickKindForState,
  streamClarification,
  _applyClarification as resolveClarification,
  fisherInformation,
  masteryToTheta,
  thetaToMastery,
  probabilityCorrect,
  _remember as remember,
  _recall as recall,
  _dropUserMemory as dropUserMemory,
  _getSession as getActiveSession,
  _dropSession as dropActiveSession,
  _turnWindow as renderTurnWindow,
  _uniformPrior as uniformPrior,
  _priorFromState as priorFromState,
  _updateWithEvidence as updateWithEvidence,
  _updateWithIDontKnow as updateWithIDontKnow,
  _updateWithSkip as updateWithSkip,
  _densityMoments as densityMoments,
  MAX_QUESTIONS,
  STOP_GLOBAL_CONFIDENCE,
  STOP_DELTA_THRESHOLD,
  STOP_STAGNANT_RUNS,
  _scheduleReviews as scheduleReviewsPure,
  intervalDays,
  priorityFor as timelinePriority,
  reasonFor as timelineReason,
  dayKey,
  dayLabel,
  isDueToday,
  isOverdue,
  MAX_ITEMS_PER_DAY,
  DEFAULT_HORIZON_DAYS,
}
export type {
  BuildStateInput,
  DiagnosisEngineState,
  PendingQuestion,
  SubmitOutput,
  StopReason,
  QuestionKind,
  ConceptStateLocal,
  ClarificationToken,
  Density,
  ScheduleInput,
  ScheduleOutput,
  TimelineConceptInput,
  ReviewReason,
}
