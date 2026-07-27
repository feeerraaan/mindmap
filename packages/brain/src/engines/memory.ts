/**
 * Memory — the Brain's short-term store for an active diagnosis session.
 *
 *   Three responsibilities, intentionally tiny:
 *
 *     1. {@link turnWindow} — render the last N conversation turns as a
 *        string the prompt can consume, with older turns summarised into
 *        a single line. Keeps the prompt budget bounded.
 *     2. {@link remember} / {@link recall} — opaque per-user, per-concept
 *        key/value cache for hints the engine has learnt (e.g. "user is a
 *        visual learner, prefer MCQ over open-ended"). Used by the
 *        evaluation engine to bias question selection.
 *     3. {@link registerSession} / {@link getSession} — track active
 *        sessions in memory so the in-process engine can resume on the
 *        same Node process. A polling client hitting a different process
 *        would still get consistent state from the DB.
 *
 *   The Brain boundary is preserved: this file never imports the DB, AI
 *   SDKs, or anything outside the allowed set. It is pure in-process
 *   state.
 */
import type { AnswerInput, DiagnosisQuestion, Evaluation } from '../schemas/diagnosis'

/** A single turn in the active session — written by the engine, not by
 *  callers directly. */
export interface SessionTurn {
  kind: 'question' | 'answer' | 'feedback' | 'clarification'
  /** ISO timestamp. */
  at: string
  /** The concept externalId this turn is about, if any. */
  conceptId?: string
  /** Question asked, if this is a question turn. */
  question?: DiagnosisQuestion
  /** User's answer, if this is an answer turn. */
  answer?: AnswerInput
  /** Evaluator output, if a feedback turn. */
  evaluation?: Evaluation
  /** Short micro-feedback string the user already saw. */
  microFeedback?: string
  /** Free text — for clarifications, status messages. */
  text?: string
}

export interface ActiveSession {
  sessionId: string
  userId: string
  documentId: string
  startedAt: number
  turns: SessionTurn[]
  /** conceptExternalId → short working note. */
  notes: Map<string, string>
}

const TURN_WINDOW = 8

const sessions = new Map<string, ActiveSession>()
const memory = new Map<string, Map<string, string>>()

function memoryKey(userId: string): Map<string, string> {
  let m = memory.get(userId)
  if (!m) {
    m = new Map()
    memory.set(userId, m)
  }
  return m
}

export function registerSession(session: ActiveSession): void {
  sessions.set(session.sessionId, session)
}

export function getSession(sessionId: string): ActiveSession | undefined {
  return sessions.get(sessionId)
}

export function dropSession(sessionId: string): void {
  sessions.delete(sessionId)
}

/** Render the last N turns as a transcript string for the prompt. */
export function turnWindow(session: ActiveSession, n: number = TURN_WINDOW): string {
  const recent = session.turns.slice(-n)
  if (recent.length === 0) return '(no prior turns in this session)'
  const lines: string[] = []
  for (const t of recent) {
    if (t.kind === 'question' && t.question) {
      const q = t.question
      const opts =
        q.kind === 'EASY' ? ` [options: ${q.options.map((o, i) => `${i}=${o}`).join(', ')}]` : ''
      lines.push(`Q (${q.kind}, d=${q.difficulty.toFixed(2)}): ${q.prompt}${opts}`)
    } else if (t.kind === 'answer' && t.answer) {
      const a = t.answer
      if (a.kind === 'MCQ') lines.push(`A: option ${a.optionIndex}`)
      else if (a.kind === 'OPEN') lines.push(`A: "${a.text}"`)
      else if (a.kind === 'IDONTKNOW') lines.push(`A: I don't know`)
      else if (a.kind === 'SKIP') lines.push(`A: (skipped)`)
    } else if (t.kind === 'feedback' && t.evaluation) {
      lines.push(
        `Eval: correctness=${t.evaluation.correctness.toFixed(2)}, isCorrect=${t.evaluation.isCorrect}, rationale="${t.evaluation.rationale}"`,
      )
    } else if (t.kind === 'clarification' && t.text) {
      lines.push(`Clarify: "${t.text}"`)
    } else if (t.microFeedback) {
      lines.push(`Feedback: "${t.microFeedback}"`)
    }
  }
  return lines.join('\n')
}

export function remember(userId: string, key: string, value: string): void {
  memoryKey(userId).set(key, value)
}

export function recall(userId: string, key: string): string | undefined {
  return memoryKey(userId).get(key)
}

export function dropUserMemory(userId: string): void {
  memory.delete(userId)
}
