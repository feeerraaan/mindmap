# MindMap — Database Design

> Prisma schema proposal. Tables use `snake_case` (plural). Prisma models use
> `PascalCase` (singular). All AI-derived data is parsed into typed columns, never
> stored as opaque JSON blobs except where explicitly marked.

---

## 1. ER Diagram (textual)

```
User 1───* Workspace 1───* Document 1───* Concept *───* ConceptDependency
                                 │            │
                                 │            └──1───* ConceptState
                                 │
                                 ├──1───* DocumentChunk   (extracted text)
                                 ├──1───* Job              (parse / diagnose / schedule)
                                 └──1───* DiagnosisSession 1───* ConversationTurn
                                                                │
                                                                └──1───* Question
                                                                            │
                                                                            └──1───? Answer

ReviewPlan 1───* ReviewSession 1───* ReviewItem
   │              │
   └─ belongs to   └─ belongs to
   Document        User
```

---

## 2. Schema (Prisma)

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider      = "prisma-client-js"
  output        = "../node_modules/.prisma/client"
  binaryTargets = ["native", "rhel8-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  extensions = [vector, pg_trgm] // vector: future RAG; pg_trgm: fuzzy concept search
}

// ───────────────────────────────────────────────────────────────────
// Identity & tenancy
// ───────────────────────────────────────────────────────────────────

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  locale        String   @default("en") // preferred UI locale
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime? // soft delete for GDPR

  sessions      Session[]
  accounts      Account[]
  workspaces    Workspace[]
  reviewSessions ReviewSession[]

  @@index([email])
  @@index([deletedAt])
}

model Account {        // Better Auth OAuth/magic-link accounts
  id                String  @id @default(cuid())
  userId            String
  providerId        String  // "google" | "magic_link"
  accountId         String
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  password          String? // always null (no passwords)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, userId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  expiresAt    DateTime
  ip           String?
  userAgent    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model Workspace {        // user-facing name: "a Mind"
  id          String   @id @default(cuid())
  ownerId     String
  name        String   // user-chosen, e.g. "Anatomy Q4"
  emoji       String?  // optional, set in onboarding
  prior       Json     // calibration prior: { confidence: 0.4, etc }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  documents   Document[]

  @@index([ownerId])
}

// ───────────────────────────────────────────────────────────────────
// Documents & Knowledge Graph
// ───────────────────────────────────────────────────────────────────

model Document {
  id            String        @id @default(cuid())
  workspaceId   String
  blobKey       String        // Vercel Blob key (signed URL generated on demand)
  filename      String
  mimeType      String
  sizeBytes     Int
  pageCount     Int?
  status        DocumentStatus
  language      String?       // detected doc language, may differ from UI locale
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  workspace     Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  chunks        DocumentChunk[]
  concepts      Concept[]
  jobs          Job[]
  diagnosisSessions DiagnosisSession[]
  reviewPlan    ReviewPlan?

  @@index([workspaceId, status])
  @@index([createdAt])
}

enum DocumentStatus {
  QUEUED       // uploaded, not yet parsed
  PARSING      // text extraction in progress
  GRAPHING     // LLM building concepts/relationships
  READY        // graph built, awaiting diagnosis
  DIAGNOSING   // active diagnosis session
  MAPPED       // diagnosis complete, map finalized
  FAILED       // parse/build failed (see Job.error)
}

model DocumentChunk {       // extracted text, paragraph-level
  id          String   @id @default(cuid())
  documentId  String
  index       Int      // order within the doc
  text        String
  page        Int?
  chapter     String?  // detected section title
  embedding   Unsupported("vector(1536)")? // future: pgvector, null in MVP

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId, index])
}

model Concept {
  id           String   @id @default(cuid())
  documentId   String
  externalId   String   // stable id assigned by the Brain (e.g. "c-12")
  title        String
  summary      String
  importance   Float    // [0,1] — estimated by Brain
  difficulty   Float    // [0,1] — estimated by Brain
  chapter      String?
  topic        String?
  createdAt    DateTime @default(now())

  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  states       ConceptState[]
  dependsOn    ConceptDependency[] @relation("Dependant")
  dependents   ConceptDependency[] @relation("Dependency")

  @@unique([documentId, externalId])
  @@index([documentId])
  @@index([documentId, importance])
}

model ConceptDependency {  // DAG edges between concepts
  dependantId  String  // concept that requires the other
  dependencyId String  // concept that is required
  weight       Float   @default(1.0)

  dependant    Concept @relation("Dependant",  fields: [dependantId],  references: [id], onDelete: Cascade)
  dependency   Concept @relation("Dependency", fields: [dependencyId], references: [id], onDelete: Cascade)

  @@id([dependantId, dependencyId])
  @@index([dependencyId])
}

// ───────────────────────────────────────────────────────────────────
// Knowledge State (per user per concept)
// ───────────────────────────────────────────────────────────────────

model ConceptState {
  id           String   @id @default(cuid())
  conceptId    String
  userId       String
  mastery      Float    @default(0.0)   // [0,1] IRT-updated
  confidence   Float    @default(0.0)   // [0,1] — model's certainty about `mastery`
  attempts     Int      @default(0)
  correct      Int      @default(0)
  lastSeen     DateTime?
  lastDelta    Float?   // last mastery change (signed)
  dueAt        DateTime? // computed by Timeline engine
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  concept      Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  @@unique([conceptId, userId])
  @@index([userId, dueAt])
  @@index([conceptId])
}

// ───────────────────────────────────────────────────────────────────
// Jobs (parse / diagnose / schedule) — persisted queue
// ───────────────────────────────────────────────────────────────────

model Job {
  id          String    @id @default(cuid())
  documentId  String?
  type        JobType
  status      JobStatus
  progress    Float     @default(0.0)   // [0,1]
  payload     Json?     // input params
  result      Json?     // final result on success
  error       String?   // structured error message
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime  @default(now())

  document    Document? @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@index([documentId, type])
}

enum JobType {
  PARSE
  BUILD_GRAPH
  DIAGNOSE
  SCHEDULE_REVIEW
}

enum JobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// ───────────────────────────────────────────────────────────────────
// Diagnosis
// ───────────────────────────────────────────────────────────────────

model DiagnosisSession {
  id           String   @id @default(cuid())
  documentId   String
  userId       String
  status       DiagnosisStatus
  questionsAsked Int    @default(0)
  globalConfidence Float @default(0.0)
  startedAt    DateTime @default(now())
  finishedAt   DateTime?

  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  turns        ConversationTurn[]

  @@index([documentId, status])
  @@index([userId, startedAt])
}

enum DiagnosisStatus {
  ACTIVE
  COMPLETED
  ABANDONED
  ERRORED
}

model ConversationTurn {
  id           String   @id @default(cuid())
  sessionId    String
  role         TurnRole // user | assistant | system
  content      String
  tokensIn     Int?
  tokensOut    Int?
  provider     String?  // "zen" | "go" | etc — for cost analytics
  model        String?  // "deepseek-v4-flash" etc
  createdAt    DateTime @default(now())

  session      DiagnosisSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question     Question?

  @@index([sessionId, createdAt])
}

enum TurnRole {
  USER
  ASSISTANT
  SYSTEM
}

model Question {
  id            String    @id @default(cuid())
  turnId        String    @unique  // the assistant turn that produced this question
  conceptId     String
  difficulty    Float     // IRT 'b' parameter generated for this question
  prompt        String
  options       Json?     // MCQ options; null for open-ended
  expectedAnswer String?

  turn          ConversationTurn @relation(fields: [turnId], references: [id], onDelete: Cascade)
  answer        Answer?

  @@index([conceptId])
}

model Answer {
  id            String   @id @default(cuid())
  questionId    String  @unique
  value         String
  isCorrect     Boolean?
  correctness   Float?   // [0,1] for partial-credit open-ended
  rationale     String?  // LLM's evaluation
  timeSpentMs   Int?
  createdAt     DateTime @default(now())

  question      Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([createdAt])
}

// ───────────────────────────────────────────────────────────────────
// Review / Timeline
// ───────────────────────────────────────────────────────────────────

model ReviewPlan {
  id          String   @id @default(cuid())
  documentId  String   @unique
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  sessions    ReviewSession[]
}

model ReviewSession {
  id          String   @id @default(cuid())
  planId      String
  userId      String
  scheduledFor DateTime
  startedAt   DateTime?
  completedAt DateTime?
  status      ReviewStatus  @default(SCHEDULED)

  plan        ReviewPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items       ReviewItem[]

  @@index([userId, scheduledFor])
  @@index([status, scheduledFor])
}

enum ReviewStatus {
  SCHEDULED
  DUE
  STARTED
  COMPLETED
  SKIPPED
}

model ReviewItem {
  id          String   @id @default(cuid())
  sessionId   String
  conceptId   String
  priority    Float    // engine-computed
  reason      String   // human-readable: "decay", "new weakness", "dependency gap"

  session     ReviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

// ───────────────────────────────────────────────────────────────────
// Audit (lightweight in MVP)
// ───────────────────────────────────────────────────────────────────

model AuditEvent {
  id        String   @id @default(cuid())
  userId    String?
  action    String   // "document.upload", etc.
  metadata  Json?
  ip        String?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
}
```

---

## 3. Index Strategy

- All foreign keys get an index (Prisma does this automatically for scalar FKs; we add
  explicit `@@index` for the hot query patterns).
- **Hot queries:**
  - `Document` by `(workspaceId, status)` — Workspace list polling
  - `Job` by `(status, createdAt)` — worker poller (queued jobs)
  - `ConceptState` by `(userId, dueAt)` — "what's due today"
  - `ReviewSession` by `(userId, scheduledFor)` — timeline view
- **Future search:** `pg_trgm` GIN index on `Concept.title` and `Concept.summary` for
  fuzzy concept search inside a Mind. Not added in MVP to keep migration light.

---

## 4. Constraints & Invariants (enforced in app code + DB)

1. **ConceptDependency is acyclic.** Validated in `packages/brain` before insert; a DB
   trigger could enforce but we keep it in code for hackathon simplicity.
2. **`Concept.externalId` is unique per document**, not globally — allows the Brain to
   emit `c-1, c-2…` per doc.
3. **`ConceptState` is unique per `(conceptId, userId)`** — a concept can be probed by
   many users (Horizon 2) without collision.
4. **Soft delete:** `User.deletedAt` cascades logically (queries filter `deletedAt IS
NULL`). Physical delete is a separate GDPR job (phase 7).

---

## 5. Migrations Strategy

- **Production / main:** `prisma migrate deploy` — every change is a reviewed migration
  file checked into `packages/database/prisma/migrations`.
- **Preview deploys:** `prisma db push` against the Neon branch (no migration history
  pollution; branches are ephemeral).
- **Local dev:** `prisma migrate dev` creates new migration files during development.
- **Seed:** `packages/database/seed.ts` seeds: 1 demo user, 1 sample document with a
  pre-built 20-concept graph (used by the live demo on the landing page).

---

## 6. Future Scalability

| Concern                       | Plan                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Million+ `ConceptState` rows  | Partition by `userId` (Neon supports declarative partitioning) once we cross 100k users    |
| `pgvector` embeddings for RAG | Already declared in `DocumentChunk.embedding`; populate post-MVP via background job        |
| Audit table bloat             | Move to cold storage (S3 / BigQuery) after 90 days, summarized into daily counts           |
| Multi-region reads            | Neon read replicas in `eu-west-1` and `us-east-1` — DNS-routed via Vercel Edge             |
| Cross-workspace concept dedup | Add `ConceptFingerprint` table (SimHash of title+summary) to merge duplicates in Horizon 2 |

---

## 7. What We Deliberately Don't Do (Yet)

- **No vector DB.** MVP doesn't do semantic search; we add `pgvector` only when a
  feature needs it (likely Horizon 2's "ask your Mind" feature).
- **No separate analytics warehouse.** `AuditEvent` + Vercel's own logs cover hackathon
  needs; PostHog or ClickHouse comes when retention questions demand it.
- **No Redis.** Better Auth uses Postgres for sessions; Job polling is cheap. Redis
  re-enters the conversation only if we adopt Inngest or need sub-100ms caching.
