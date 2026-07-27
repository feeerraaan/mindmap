import { z } from 'zod'

/**
 * Domain types — single source of truth.
 *
 * Every Zod schema here is the contract between packages. Both runtime validation and
 * inferred TS types are exported. No package may define its own copy of these shapes.
 */

export { z }

/* ──────────────────────────────────────────────────────────────────
 * Identity
 * ────────────────────────────────────────────────────────────────── */

export const LocaleSchema = z.enum(['en', 'es'])
export type Locale = z.infer<typeof LocaleSchema>

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.date().nullable(),
  name: z.string().nullable(),
  image: z.string().url().nullable(),
  locale: LocaleSchema.default('en'),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type User = z.infer<typeof UserSchema>

/* ──────────────────────────────────────────────────────────────────
 * Workspace (a "Mind")
 * ────────────────────────────────────────────────────────────────── */

export const WorkspaceSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string().min(1).max(60),
  emoji: z.string().max(8).nullable(),
  examDate: z.date().nullable(),
  prior: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Workspace = z.infer<typeof WorkspaceSchema>

/* ──────────────────────────────────────────────────────────────────
 * Document
 * ────────────────────────────────────────────────────────────────── */

export const DocumentStatusSchema = z.enum([
  'QUEUED',
  'PARSING',
  'GRAPHING',
  'READY',
  'DIAGNOSING',
  'MAPPED',
  'FAILED',
])
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>

export const DocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  blobKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nullable(),
  status: DocumentStatusSchema,
  language: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Document = z.infer<typeof DocumentSchema>

/* ──────────────────────────────────────────────────────────────────
 * Knowledge Graph
 * ────────────────────────────────────────────────────────────────── */

export const ConceptSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  externalId: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  importance: z.number().min(0).max(1),
  difficulty: z.number().min(0).max(1),
  chapter: z.string().nullable(),
  topic: z.string().nullable(),
  createdAt: z.date(),
})
export type Concept = z.infer<typeof ConceptSchema>

export const ConceptDependencySchema = z.object({
  dependantId: z.string(),
  dependencyId: z.string(),
  weight: z.number().min(0).max(1).default(1),
})
export type ConceptDependency = z.infer<typeof ConceptDependencySchema>

export const KnowledgeGraphSchema = z.object({
  concepts: z.array(ConceptSchema),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      weight: z.number().min(0).max(1),
    }),
  ),
})
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>

/* ──────────────────────────────────────────────────────────────────
 * Knowledge State
 * ────────────────────────────────────────────────────────────────── */

export const ConceptStateSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  userId: z.string(),
  mastery: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  lastSeen: z.date().nullable(),
  lastDelta: z.number().nullable(),
  dueAt: z.date().nullable(),
  updatedAt: z.date(),
})
export type ConceptState = z.infer<typeof ConceptStateSchema>

/* ──────────────────────────────────────────────────────────────────
 * Diagnosis
 * ────────────────────────────────────────────────────────────────── */

export const DiagnosisStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'ABANDONED', 'ERRORED'])
export type DiagnosisStatus = z.infer<typeof DiagnosisStatusSchema>

export const DiagnosisSessionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  status: DiagnosisStatusSchema,
  questionsAsked: z.number().int().nonnegative(),
  globalConfidence: z.number().min(0).max(1),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
})
export type DiagnosisSession = z.infer<typeof DiagnosisSessionSchema>

export const TurnRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM'])
export type TurnRole = z.infer<typeof TurnRoleSchema>

export const QuestionSchema = z.object({
  id: z.string(),
  turnId: z.string(),
  conceptId: z.string(),
  difficulty: z.number().min(-3).max(3),
  prompt: z.string().min(1),
  options: z.array(z.string()).nullable(),
  expectedAnswer: z.string().nullable(),
})
export type Question = z.infer<typeof QuestionSchema>

export const AnswerSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  value: z.string(),
  isCorrect: z.boolean().nullable(),
  correctness: z.number().min(0).max(1).nullable(),
  rationale: z.string().nullable(),
  timeSpentMs: z.number().int().nullable(),
  createdAt: z.date(),
})
export type Answer = z.infer<typeof AnswerSchema>

/* ──────────────────────────────────────────────────────────────────
 * Review
 * ────────────────────────────────────────────────────────────────── */

export const ReviewStatusSchema = z.enum(['SCHEDULED', 'DUE', 'STARTED', 'COMPLETED', 'SKIPPED'])
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

export const ReviewPlanSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  createdAt: z.date(),
})
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>

export const ReviewSessionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  userId: z.string(),
  scheduledFor: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  status: ReviewStatusSchema,
})
export type ReviewSession = z.infer<typeof ReviewSessionSchema>

export const ReviewItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  conceptId: z.string(),
  priority: z.number().min(0).max(1),
  reason: z.string(),
})
export type ReviewItem = z.infer<typeof ReviewItemSchema>

/* ──────────────────────────────────────────────────────────────────
 * Job
 * ────────────────────────────────────────────────────────────────── */

export const JobTypeSchema = z.enum(['PARSE', 'BUILD_GRAPH', 'DIAGNOSE', 'SCHEDULE_REVIEW'])
export type JobType = z.infer<typeof JobTypeSchema>

export const JobStatusSchema = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
export type JobStatus = z.infer<typeof JobStatusSchema>

export const JobSchema = z.object({
  id: z.string(),
  documentId: z.string().nullable(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  progress: z.number().min(0).max(1),
  payload: z.record(z.unknown()).nullable(),
  result: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  createdAt: z.date(),
})
export type Job = z.infer<typeof JobSchema>

/* ──────────────────────────────────────────────────────────────────
 * Parser output (used between packages/parser and packages/brain)
 * ────────────────────────────────────────────────────────────────── */

export const DocumentChunkSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  page: z.number().int().nullable(),
  chapter: z.string().nullable(),
})
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>

export const ParsedDocumentSchema = z.object({
  chunks: z.array(DocumentChunkSchema).min(1),
  pageCount: z.number().int().positive().nullable(),
  language: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
})
export type ParsedDocument = z.infer<typeof ParsedDocumentSchema>

/* ──────────────────────────────────────────────────────────────────
 * Brain API surface
 * ────────────────────────────────────────────────────────────────── */

export const TaskTypeSchema = z.enum([
  'classify.language',
  'classify.topic',
  'extract.structure',
  'extract.relationships',
  'extract.metadata',
  'reason.diagnose',
  'reason.evaluate',
  'reason.clarify',
  'summarize.concept',
  'schedule.review',
])
export type TaskType = z.infer<typeof TaskTypeSchema>

export const ProviderIdSchema = z.enum(['zen', 'go'])
export type ProviderId = z.infer<typeof ProviderIdSchema>

/* ──────────────────────────────────────────────────────────────────
 * Brain errors
 * ────────────────────────────────────────────────────────────────── */

export const BrainErrorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('RateLimited'),
    provider: ProviderIdSchema,
    retryAfterMs: z.number(),
  }),
  z.object({ kind: z.literal('SchemaFailure'), task: TaskTypeSchema, message: z.string() }),
  z.object({ kind: z.literal('ProviderError'), provider: ProviderIdSchema, message: z.string() }),
  z.object({ kind: z.literal('BudgetExceeded'), userId: z.string() }),
  z.object({ kind: z.literal('InvalidInput'), message: z.string() }),
])
export type BrainError = z.infer<typeof BrainErrorSchema>
