/**
 * Brain — phase 1 stub.
 *
 * The full public API surface is declared here so apps/web and other
 * packages can already type-check their call sites. Real implementations
 * land in phases 4 (knowledge engine) and 5 (evaluation engine).
 *
 * Invariant: this is the only package that may import an AI SDK or call
 * any LLM endpoint. Enforced by ESLint boundary rules + a CI grep.
 */
import { Err, Ok, type Result, type SseEvent } from '@mindmap/shared'
import type { BrainError, KnowledgeGraph, ParsedDocument } from '@mindmap/types'

export interface KnowledgeBuildInput {
  document: ParsedDocument
  userId: string
}

export interface DiagnosisEvent extends SseEvent {
  event: 'question' | 'microfeedback' | 'state' | 'complete' | 'error'
}

export interface KnowledgeBuildResult {
  graph: KnowledgeGraph
  tokensIn: number
  tokensOut: number
}

async function notImplemented<T>(what: string): Promise<Result<T, BrainError>> {
  return Err({ kind: 'InvalidInput', message: `Brain.${what} is not yet implemented (phase 4+).` })
}

export const Brain = {
  knowledge: {
    async buildGraph(_input: KnowledgeBuildInput): Promise<Result<KnowledgeBuildResult, BrainError>> {
      return notImplemented('knowledge.buildGraph')
    },
  },
  evaluation: {
    async *startDiagnosis(_sessionId: string): AsyncIterable<DiagnosisEvent> {
      yield {
        event: 'error',
        data: JSON.stringify({
          kind: 'InvalidInput',
          message: 'Brain.evaluation.startDiagnosis ships in phase 5.',
        }),
      }
    },
    async submitAnswer(_sessionId: string, _answer: string): Promise<Result<unknown, BrainError>> {
      return notImplemented('evaluation.submitAnswer')
    },
    async nextQuestion(_sessionId: string): Promise<Result<unknown, BrainError>> {
      return notImplemented('evaluation.nextQuestion')
    },
    async finalize(_sessionId: string): Promise<Result<unknown, BrainError>> {
      return notImplemented('evaluation.finalize')
    },
  },
  timeline: {
    async scheduleReviews(_userId: string, _documentId: string): Promise<Result<unknown, BrainError>> {
      return notImplemented('timeline.scheduleReviews')
    },
    async nextDue(_userId: string): Promise<Result<unknown, BrainError>> {
      return Ok([])
    },
  },
  conversation: {
    async *clarify(_sessionId: string, _message: string): AsyncIterable<{ token: string }> {
      yield { token: '[stub] clarify not implemented yet' }
    },
  },
  memory: {
    async remember(_userId: string, _key: string, _value: unknown): Promise<void> {
      /* noop */
    },
    async recall(_userId: string, _key: string): Promise<unknown> {
      return null
    },
  },
} as const
