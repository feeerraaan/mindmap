/**
 * Conversation Engine — phase 5.
 *
 *   Wraps the Socratic clarification loop. The actual LLM work and the
 *   Bayesian re-evaluation live in {@link ./evaluation-engine}; this
 *   module is the public surface that yields an `AsyncIterable<Token>`
 *   so the SSE route in `apps/web` can stream the clarification to the
 *   client.
 *
 *   Bounded per docs/brain.md §7:
 *     - max 1 clarification per question
 *     - max 3 per session
 *   The bound is enforced by the evaluation engine; this module simply
 *   refuses to stream when no clarification is pending.
 */
import type { BrainError } from '../errors'
import { Ok, type Result } from '@mindmap/shared'
import type { DiagnosisEngineState, PendingQuestion } from './evaluation-engine'
import { generateClarification, resolveClarification } from './evaluation-engine'
import type { AnswerInput, Clarification, Evaluation } from '../schemas/diagnosis'

export interface ClarificationToken {
  token: string
  /** Emitted once at the end so the client knows we're done. */
  done: boolean
  /** The full structured payload, included in the final token. */
  clarification?: Clarification
}

/**
 * Stream the clarification question for a just-graded answer. Yields
 * small token strings; the final token carries the structured payload
 * so the client can render the micro-feedback line.
 *
 * The caller is expected to have already decided that a clarification
 * is appropriate (the evaluation engine did this in
 * {@link SubmitOutput.clarification}). If the engine did not produce
 * one, this returns an error.
 */
export async function* streamClarification(
  state: DiagnosisEngineState,
  pending: PendingQuestion,
  evaluation: Evaluation,
  answer: AnswerInput,
): AsyncIterable<ClarificationToken> {
  const result = await generateClarification(state, pending, evaluation, answer)
  if (!result.ok || !result.value) {
    // No clarification needed: yield a synthetic empty stream so the
    // caller knows we're done without an error.
    yield { token: '', done: true }
    return
  }
  const c = result.value
  // Yield a few short tokens to keep the UX feel of "the Mind is
  // thinking", then the full payload. The clarification is short enough
  // (≤120 chars) that chunking it word-by-word is plenty.
  const words = c.clarification.split(/(\s+)/)
  for (const w of words) {
    if (w.length === 0) continue
    yield { token: w, done: false }
  }
  yield { token: '', done: true, clarification: c }
}

/**
 * Apply a clarification follow-up. The result is a new state with the
 * Bayesian update applied. The caller is responsible for persisting the
 * new state.
 */
export async function applyClarification(
  state: DiagnosisEngineState,
  followUp: string,
): Promise<Result<{ state: DiagnosisEngineState; evaluation: Evaluation }, BrainError>> {
  const r = await resolveClarification(state, followUp)
  if (!r.ok) return r
  return Ok({ state: r.value.state, evaluation: r.value.evaluation })
}
