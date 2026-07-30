/**
 * Zod schemas for the diagnosis pipeline.
 *
 * Every LLM output in `reason.*` is validated against one of these before it
 * is persisted or used to update Bayesian state. The two diagnosis question
 * schemas - easy (MCQ) and hard (open) - share a base but diverge on the
 * answer format.
 */
import { z } from 'zod'

/** EASY (MCQ) question. The LLM produces 4 options + a correctIndex. */
export const DiagnoseEasySchema = z.object({
  prompt: z.string().min(8).max(400),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  difficulty: z.number().min(-3).max(3),
  microFeedback: z.string().min(1).max(200),
})
export type DiagnoseEasy = z.infer<typeof DiagnoseEasySchema>

/** HARD (open-ended) question. No options; graded by the evaluator. */
export const DiagnoseHardSchema = z.object({
  prompt: z.string().min(8).max(400),
  difficulty: z.number().min(-3).max(3),
  microFeedback: z.string().min(1).max(200),
})
export type DiagnoseHard = z.infer<typeof DiagnoseHardSchema>

/** Discriminated wrapper so the engine can store either shape uniformly. */
export const DiagnosisQuestionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('EASY'), ...DiagnoseEasySchema.shape }),
  z.object({ kind: z.literal('HARD'), ...DiagnoseHardSchema.shape }),
])
export type DiagnosisQuestion = z.infer<typeof DiagnosisQuestionSchema>

/** Evaluator output. correctness is the continuous signal. */
export const EvaluationSchema = z.object({
  correctness: z.number().min(0).max(1),
  isCorrect: z.boolean(),
  rationale: z.string().min(1).max(500),
  microFeedback: z.string().min(1).max(200),
})
export type Evaluation = z.infer<typeof EvaluationSchema>

/** Clarifier output. A short Socratic follow-up question. */
export const ClarificationSchema = z.object({
  clarification: z.string().min(8).max(240),
  microFeedback: z.string().min(1).max(200),
})
export type Clarification = z.infer<typeof ClarificationSchema>

/** Learn phase output. A concise explanation of a concept. */
export const LearnSchema = z.object({
  explanation: z.string().min(20).max(1000),
})
export type LearnOutput = z.infer<typeof LearnSchema>

/** The user's answer envelope. Lets us distinguish MCQ vs open vs idn/skip. */
export const AnswerKindSchema = z.enum(['MCQ', 'OPEN', 'IDONTKNOW', 'SKIP'])
export type AnswerKind = z.infer<typeof AnswerKindSchema>

/** A light validator for an incoming answer - used at the API boundary. */
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
export type AnswerInput = z.infer<typeof AnswerInputSchema>
