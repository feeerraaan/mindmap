<h1 align="center">MindMap</h1>

<p align="center"><em>Your knowledge is a living map.</em></p>

<p align="center">
  <a href="https://mindmap.azpy.es/en"><img alt="Live Demo" src="https://img.shields.io/badge/Live%20Demo-mindmap.azpy.es-0066cc?style=for-the-badge"></a>
  <a href="https://youtu.be/3PRoDq0flSo"><img alt="Launch Video" src="https://img.shields.io/badge/Video-YouTube-ff0000?style=for-the-badge"></a>
  <a href="https://github.com/feeerraaan/mindmap"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-repo-181717?style=for-the-badge&logo=github"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js%2016-black?style=flat-square&logo=next.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-Neon-2d3748?style=flat-square&logo=prisma">
  <img alt="Status" src="https://img.shields.io/badge/status-shipping-16a34a?style=flat-square">
</p>

---

MindMap is a **diagnostic** learning tool, not a summarizer. You upload a document
(PDF / PPTX / DOCX) and MindMap builds a **Knowledge Graph** of its concepts,
then runs an **adaptive diagnosis** - a calm Socratic interview rooted in Item
Response Theory and Bayesian estimation - to discover what you *truly* know
versus what you only *recognize*. The output is a visual knowledge map plus a
personalized, adaptive review timeline.

It is built for **autonomous adult learners** preparing for high-stakes exams -
medical residents, bar and CFA candidates, engineers studying system design or
algorithms, language learners past the B2 plateau - and for curious
professionals who read books and courses but want an **honest** map of what
actually stuck.

What makes it different from traditional study tools is the inversion: most tools
optimize for *producing* (more flashcards, more summaries, more quizzes), while
MindMap optimizes for *understanding* - building a precise, honest model of a
learner's knowledge state, then making that model visible and actionable. The
highest-leverage moment in learning is not the moment you study; it is the moment
you realize **you didn't actually know what you thought you knew**. MindMap
manufactures that moment, repeatedly, calmly, and with care.

---

## 2. The Problem

Students read books, PDFs, and slides, but they don't actually know:

- what they **truly understand**
- what they only **recognize** (the "illusion of competence")
- what they **misunderstand**
- what they should **study next**

Static quizzes and flashcards can't fix this. They ask the same predetermined
questions of everyone, never adapt to the learner's evolving state, and treat
"recognition" as "knowledge." Spaced-repetition tools like Anki/Quizlet still use
a 1985 forgetting curve applied identically to every item and require manual card
authoring. AI summarizers (NotebookLM-style) do the work *for* you, which teaches
you nothing about your own gaps. None of them give you an **honest model** of your
own mind - which is the actual bottleneck.

---

## 3. The Solution

MindMap's learning loop:

```
   Upload  →  Understand  →  Knowledge Graph  →  Diagnose  →  Identify Gaps
                                                                     ↓
   Remember  ←   Verify   ←      Learn       ←    (adaptive)
```

- **Upload** - Drop a PDF, DOCX, or PPTX. Mime-allowlisted, 25 MB cap.
- **Understand** - The document is parsed and split into chunks; its language is
  classified.
- **Knowledge Graph** - The AI extracts chapters → topics → concepts and the
  dependency edges between them, validated against a Zod schema and an acyclicity
  check.
- **Diagnose** - An adaptive, IRT-driven interview asks the *minimum* number of
  questions that *maximally* increase information about your knowledge state.
- **Identify Knowledge Gaps** - Weak concepts (low mastery or low confidence) are
  surfaced; neighbor concepts are propagated through the dependency graph.
- **Learn** - For each gap, MindMap generates a concise concept explanation.
- **Verify** - Deeper, open-ended ("describe in your own words") questions
  confirm the learned knowledge, semantically evaluated by the LLM.
- **Remember** - A pure-math Timeline Engine schedules spaced reviews adapted to
  each concept's measured `(mastery, confidence)`, not a fixed forgetting curve.

---

## 4. Key Features

| Area | Feature | Notes |
| ---- | ------- | ---- |
| AI | Document understanding | PDF (`pdftotext`), DOCX (`mammoth`), PPTX (`jszip`), run on a VPS worker |
| AI | Concept extraction & Knowledge Graph | 5-stage pipeline, Zod-validated, acyclic edges |
| AI | Adaptive diagnosis | IRT 1PL + Fisher information, Bayesian grid update |
| AI | AI-generated questions | JIT, batched upfront for instant UX |
| AI | Open-ended evaluation | Semantic correctness scoring ∈ [0,1] |
| AI | Socratic clarification | SSE streaming on ambiguous answers (≤1/question, ≤3/session) |
| AI | Knowledge gap detection | Weak concepts + neighbor propagation through the DAG |
| AI | Learn explanations | AI-generated concept summaries for the weakest concepts |
| Engine | Mastery estimation | Per-concept `(mastery, confidence, attempts, lastSeen)` |
| Engine | Adaptive review timeline | Pure-math spacing keyed off measured mastery |
| UX | Knowledge Map | `@xyflow/react` graph, mastery×confidence×importance encoding |
| UX | Timeline / History | Today / Upcoming / Overdue + last-10 sessions |
| Org | Workspace management | "Your Mind" workspace, doc list with status badges |
| Org | Multi-language | EN (default) + ES via `next-intl`, `hreflang` alternates |
| Org | PWA | Installable `manifest.webmanifest`, precaching service worker |
| Auth | Email + Password | Primary auth via Better Auth |
| Auth | Google OAuth | Optional, env-driven |
| Auth | Magic link | Dev-only backdoor + `/api/dev/sign-in` demo login |
| Quality | Accessibility | `prefers-reduced-motion`, ARIA roles, keyboard nav |
| Quality | SEO | Per-locale sitemap, `robots.ts`, dynamic OG images |
| Quality | Security | CSP, `X-Frame-Options`, `X-Content-Type-Options`, etc. |
| Quality | GDPR | `GET /api/export` data export endpoint |
| Quality | Tests | Vitest unit + Brain native tests + E2E scripts |

> **Intentionally not in scope** (do not present as features): OCR for
> scanned PDFs, billing/subscription tiers, mobile-native app, collaborative
> maps, full LMS features, multi-document merged graphs. These are future work.

---

## 5. How It Works

The real pipeline, end to end:

```
Document Upload
   ↓
Text Extraction        (parser adapters: pdftotext / mammoth / jszip)
   ↓
Concept Extraction     (classify.language → extract.structure → summarize.concept)
   ↓
Knowledge Graph        (extract.relationships → Zod-validate → acyclic check)
   ↓
Adaptive Diagnosis     (GENERATE question + Bayesian update + stopping rule)
   ↓
Knowledge State Update (mastery / confidence / dueAt persisted to ConceptState)
   ↓
Learn                  (AI writes a concise explanation for the weakest concept)
   ↓
Verify                 (open-ended question + semantic correctness scoring)
   ↓
Review Planning        (Timeline Engine - pure math, no LLM)
```

The diagnosis itself runs as a **4-phase cycle** inside one session:
`DIAGNOSE → LEARN → PRACTICE → VERIFY`. The conversation is framed as a calm
interview, not a quiz - no question count is shown mid-session, only a progress
ring. On completion, the Knowledge Map animates from grayscale to colored as
mastery fills in: the product's hero moment.

---

## 6. AI Architecture

MindMap is AI-first. The `packages/brain` package is the **only** place in the
codebase that imports an AI SDK or calls an LLM - this is enforced by ESLint and
fails CI if violated. Every other package sees only a typed `Brain` object.

### Where AI is used

| Stage | AI call (task) | Model tier | Output |
| --- | --- | --- | --- |
| Document understanding | `classify.language` | cheap | doc locale |
| Concept extraction | `extract.structure`, `extract.metadata`, `summarize.concept` | cheap | chapters/topics/concepts + priors |
| Graph generation | `extract.relationships` | cheap | acyclic dependency edges (Zod-validated) |
| Diagnosis - diagnostic question | `reason.diagnose.easy` / `reason.diagnose.hard` | reasoning | MCQ or open question |
| Open-ended evaluation | `reason.evaluate` | reasoning | `correctness ∈ [0,1]` + feedback |
| Socratic clarification | `reason.clarify` | reasoning | SSE-streamed follow-up |
| Learn explanation | (reasoning prompt) | reasoning | concise concept explanation |

All prompts live as **versioned `.md` files** in `packages/prompts` with YAML
frontmatter, rendered with mustache - non-engineers can edit copy without
touching TS. Every LLM response is parsed with `extractJson` and validated
against a **Zod schema**; on failure we retry with a "schema-repair" prompt (max
2), then mark the concept `failed` and continue - partial graphs over total
failure. Cycles in the edges are rejected via a Tarjan pass.

### What is **not** AI

| Concern | Implementation |
| --- | --- |
| Persistence | Prisma → Neon Postgres |
| Scheduling / **Review engine** | `TimelineEngine` - pure math, zero LLM calls |
| Adaptive stopping | `EvaluationEngine` stopping rule (local) |
| Neighbor propagation | local DAG walk |
| Token budget / cost guard | Router `token-bucket` + per-user daily budget |
| State management | Next.js RSC + Server Actions + React Query |
| Authentication | Better Auth (email/password, optional Google) |
| Real-time transport | SSE + polling fallback |
| Storage | VPS private service / Vercel Blob / local FS |
| UI / API | Next.js 16 App Router + Route Handlers |

The split is deliberate: AI is central to *thinking* (understanding, diagnosis,
evaluation, teaching), while everything **measurable** (scheduling, scoring
math, state) is deterministic local code. This keeps costs bounded and behavior
auditable.

---

## 7. Technical Architecture

```mermaid
flowchart TD
    U[User Browser / PWA]
    U -->|HTTP/SSE| FE[Next.js 16 Frontend<br/>App Router · RSC · Server Actions]
    FE -->|typed| API[Route Handlers<br/>/api/diagnosis · /api/timeline · /api/uploads]
    FE -->|typed| DB[(Prisma → Neon Postgres)]
    API --> DB
    FE -->|enqueue| JOB[(Job queue in Postgres)]
    JOB -->|poll claim| WK[VPS Worker<br/>@mindmap/processor]
    WK -->|download originals| ST[(VPS private storage<br/>scripts/storage-server.mjs)]
    WK -->|buildGraph · parse| BR[packages/brain<br/>public AI surface]
    BR -->|@ai-sdk/openai-compatible| AI[OpenCode ZEN / GO<br/>DeepSeek-class models]
    FE -->|Better Auth| AUTH[packages/auth<br/>Email+Password · Google · magic-link]
    AUTH --> DB
    FE -->|Resend email| RS[Resend]
```

The worker lives on the VPS because PDF parsing needs `pdftotext` (Poppler) and
the knowledge-graph LLM calls exceed Vercel's serverless `maxDuration`. Atomic
`QUEUED → RUNNING` claims let it scale to multiple workers later. The web app on
Vercel only handles short-lived requests (auth, SSE diagnosis, timeline reads).
Note: the **AI layer** (`packages/brain`) is reached *only* from the worker (for
graph building) and the web app (for diagnosis / evaluation), never from UI
components directly.

---

## 8. Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js 16 (App Router, RSC), React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind CSS v4, shadcn/ui, Framer Motion, `@xyflow/react` (Knowledge Map), React Query, `react-dropzone`, `lucide-react` |
| **Backend** | Next.js Route Handlers + Server Actions, SSE transport with polling fallback |
| **Database** | Prisma ORM + Neon Postgres (with `pgvector` + `pg_trgm` extensions declared) |
| **Authentication** | Better Auth - Email/Password, optional Google OAuth, magic-link (dev) |
| **Storage** | VPS private storage service (`scripts/storage-server.mjs` on PM2) or Vercel Blob or local FS (env-driven) |
| **AI** | `packages/brain` over `@ai-sdk/openai-compatible`; OpenCode ZEN (fallback) + OpenCode GO (primary); DeepSeek-class models |
| **Infrastructure** | pnpm workspaces + Turborepo, PM2 process manager on the VPS, nginx, Docker (`pgvector`) |
| **Deployment** | Vercel (web) + VPS (worker + storage + Postgres), `ecosystem.config.cjs` |
| **Tooling** | ESLint flat config with enforced import boundaries, Prettier, Vitest, Node native test runner (Brain), Playwright, `tsx`, TypeScript 5.6 |
| **i18n / SEO / PWA** | `next-intl` (EN/ES), `sitemap.ts`, `robots.ts`, `@vercel/og` OG images, `manifest.webmanifest` + service worker |

---

## 9. Screenshots

Desktop captures (1440×900) under `scripts/screenshots/`.

| Screen | File |
| --- | --- |
| Public landing | `screenshots/01-landing.png` |
| Public sign-in | `screenshots/02-sign-in.png` |
| Mind (loading state) | `screenshots/03-mind-loading.png` |
| Upload (dropzone + progress) | `screenshots/04-upload.png` |
| Knowledge Graph (mapped) | `screenshots/05-knowledge-map.png` |
| Diagnosis (question card) | `screenshots/06-diagnosis.png` |
| Review Timeline | `screenshots/07-timeline.png` |
| History | `screenshots/08-history.png` |

Capture with `node scripts/screenshots.js` (Playwright).

---

## 10. Demo

- **Live Demo:** <https://mindmap.azpy.es/en> - click **"sign in as demo"** on
  the sign-in form to enter the seeded `demo@mindmap.app` account with a sample
  graph already diagnosed.
- **Launch Video:** <https://youtu.be/3PRoDq0flSo>

In the demo you sign in, open your Mind, upload (or open a pre-mapped) PDF, watch
its concepts get extracted into a Knowledge Graph, then run an adaptive diagnosis
that progressively reveals what you know. The Knowledge Map fills in with color
as your measured mastery emerges; the timeline then schedules your next review,
adapted to where your confidence actually is.

---

## 11. Local Development

### Requirements

- Node ≥ 20.18
- pnpm ≥ 10 (pinned `11.13.1` via `packageManager` - `corepack` enables it)
- PostgreSQL 16+ with `pgvector` and `pg_trgm` extensions (Neon recommended)
- Poppler (`pdftotext`) for PDF parsing (or run parsing on the VPS worker)
- An `OPENCODE_*_KEY` for the AI providers (ZEN and GO share one key)

### Installation

```bash
git clone https://github.com/feeerraaan/mindmap.git
cd mindmap
corepack enable
pnpm install
cp .env.example .env          # fill in the keys below
```

### Environment variables

See `.env.example` for the full, documented list. The essentials:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/mindmap?schema=public"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="http://localhost:3100"
GOOGLE_CLIENT_ID=""          # optional, leave empty to disable Google
OPENCODE_GO_BASE_URL="https://opencode.ai/zen/go/v1"
OPENCODE_GO_KEY="..."
OPENCODE_GO_MODEL="deepseek-v4-flash"
OPENCODE_ZEN_BASE_URL="https://opencode.ai/zen/v1"
OPENCODE_ZEN_KEY="..."        # same key as GO
OPENCODE_ZEN_MODEL="deepseek-v4-flash"
BRAIN_DAILY_BUDGET="500000"
# ^^ storage, Resend, app URLs - see .env.example
```

### Database setup

```bash
pnpm db:generate      # prisma generate
pnpm db:push          # apply schema (no migration history)
pnpm db:seed          # seed demo@mindmap.app + a sample graph
```

### Development

```bash
pnpm dev              # http://localhost:3100 (turbo dev → apps/web)
# Magic-link tokens are logged to console + written to
# $TMPDIR/mindmap-magic-links/ in dev.
```

### Build / typecheck / lint / test

```bash
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # ESLint across all packages
pnpm format           # Prettier write
pnpm build            # turbo build
pnpm --filter @mindmap/web test        # Vitest unit tests
cd packages/brain && ./node_modules/.bin/tsx --test 'src/**/*.test.ts'   # Brain tests
```

### Production

The repo deploys the web app to **Vercel** and runs the worker + storage +
Postgres on a **VPS** orchestrated with PM2 (`ecosystem.config.cjs`):

```bash
pnpm --filter @mindmap/web build
pnpm --filter @mindmap/web start      # http://localhost:3100
pm2 start ecosystem.config.cjs        # web + storage + worker
```

If you bump `schema.prisma`, run `pnpm --filter @mindmap/database generate`
**and** restart the dev server - Turbopack caches the Prisma client.

---

## 12. Project Structure

```
mindmap/
├── apps/
│   └── web/                  # Next.js 16 - the only deployable (Vercel)
│       ├── src/
│       │   ├── app/          # App Router: [locale]/(marketing) (auth) (app) + api/
│       │   ├── components/   # feature UI: map, diagnosis, timeline, history, …
│       │   ├── features/     # server actions + React Query hooks (per domain)
│       │   ├── lib/          # auth, db, brain, i18n, storage, jobs
│       │   ├── hooks/        # use-prefers-reduced-motion, motion variants
│       │   ├── i18n/         # next-intl routing + request config
│       │   └── messages/     # en.json, es.json (namespaced catalogs)
│       └── public/           # PWA icons, service worker, robots.txt
├── packages/
│   ├── brain/                # AI: router, providers, engines, schemas, retry
│   ├── parser/               # PDF / DOCX / PPTX adapters → ParsedDocument
│   ├── processor/            # PARSE + BUILD_GRAPH jobs (VPS worker entrypoint)
│   ├── database/             # Prisma schema, client, migrations, seeds, e2e tests
│   ├── auth/                 # Better Auth server + client + helpers
│   ├── ui/                   # shadcn/ui-based design system (prop-in / event-out)
│   ├── prompts/              # versioned .md prompt templates (YAML frontmatter)
│   ├── types/                # cross-package Zod domain types (leaf)
│   ├── shared/               # pure utils: id, dates, retry, SSE, Result (leaf)
│   ├── analytics/            # event tracking abstraction (noop → PostHog)
│   └── config/               # eslint flat config, tsconfig base, tailwind preset (leaf)
├── scripts/                  # storage-server.mjs, screenshots.js, screenshots/
├── docs/                     # vision, product, architecture, brain, roadmap, adr/
├── video/ · video-remotion/  # demo-video HyperFrames + Remotion sources
├── turbo.json · pnpm-workspace.yaml · ecosystem.config.cjs · vercel.json
└── AGENTS.md · DESIGN.md · STATUS.md
```

### Architecture rules (enforced by ESLint)

- **`packages/brain` is the only package that may import an AI SDK or call an
  LLM.** Violations fail `pnpm lint`.
- **`packages/ui` never imports `brain`/`database`/`auth`** - components accept
  props, emit events, never fetch.
- **`any` is banned**; `unknown` + narrowing only.
- **No barrel files** at the package root; sub-path exports via `package.json`
  `exports`.

---

## 13. Educational Impact

MindMap improves learning on four fronts, all backed by the diagnosis model:

1. **Identifying knowledge gaps.** The Bayesian estimate per concept surfaces the
   exact concepts your *confidence* is low on, even if your *mastery* feels high
   - separating recognition from understanding. Weak concepts are propagated to
   neighbors through the dependency DAG, so you discover structural gaps, not just
   isolated ones.
2. **Adaptive learning.** Fisher information selects the next question that
   *maximally* increases information about your state, biased toward important
   and low-confidence concepts. This means fewer questions for a confident expert
   and more for a struggling reader - the same content, very different paths.
3. **Verification instead of memorization.** The `VERIFY` phase asks open-ended
   questions ("describe in your own words…") and semantically evaluates the
   answer, so recognition-based bluffing doesn't inflate mastery. "I don't know"
   is a first-class action that *raises* confidence (honest signal) while "Skip"
   lowers it - reinforcing honesty rather than guessing.
4. **Long-term retention.** The Timeline Engine spaces reviews off the *measured*
   `(mastery, confidence)`, not a fixed 1985-style curve. A concept you've truly
  internalized spaces out fast; a concept that's wobbling comes back sooner.
   Missed reviews do not pile up punitively - intervals soften rather than
   double.

---

## 14. Why AI Matters

Without AI, MindMap simply could not exist in its current form:

- **Concept extraction is not pattern matching.** Turning an arbitrary textbook
  PDF into a structured, dependency-linked Knowledge Graph requires real
  comprehension - chapter/topic/concept decomposition, importance and difficulty
  priors, semantic relationships. Rule-based extraction can't generalize across
  arbitrary documents.
- **Adaptive questioning is information-theoretic.** The IRT + Fisher-information
  selection needs an LLM to generate *new* questions tuned to each concept and
  difficulty, not pull from a frozen bank. The router picks the cheapest model
  that's good enough per task, keeping cost under ~$0.03 per 30-question
  diagnosis.
- **Open-ended evaluation needs semantic grading.** A correct answer to
  "describe how a page fault is handled" cannot be matched against a template.
  The LLM scores correctness ∈ [0,1] and produces the micro-feedback line.
- **Socratic clarification is conversational.** When an answer is ambiguous, a
  short streamed follow-up resolves it - that's only possible with a language
  model.

Critically, AI is **contained**: every LLM call is schema-validated, retried with
repair, budgeted per user, and routed through one typed surface. The deterministic
parts (scheduling, IRT math, Bayesian update, state persistence) are pure local
code - auditable, testable, and free. AI is the *thinking* layer; everything else
is engineering.

---

## 15. Challenges

Engineering challenges visible in the repository:

- **Keeping the AI boundary airt.** `packages/brain` is the only package allowed
  to import an AI SDK; the rule is enforced in ESLint's flat config
  (`no-restricted-paths` + `import/no-cycle`), so the boundary can't quietly
  erode as the app grows.
- **Schema-repair without token blowup.** LLMs return prose-wrapped or invalid
  JSON; an `extractJson` helper strips fences, a Zod schema validates, and a
  "repair" prompt re-asks with the validation error - capped at 2 retries, after
  which the concept is marked `failed` and the graph continues (partial results
  over total failure).
- **Acyclic graph from an LLM.** Extracted dependency edges can contain cycles;
  a Tarjan SCC pass rejects them and drops the offending edges with a warning
  rather than failing the whole build.
- **SSE that survives demo WiFi.** Diagnosis uses SSE with a one-shot reconnect
  and then a React-Query polling fallback, so a dropped connection resumes from
  the persisted `DiagnosisSession` state instead of erroring.
- **Serverless time limits vs. parsing + graphing.** `pdftotext` isn't on
  Vercel and the graph LLM calls exceed `maxDuration`, so parsing and graphing
  were moved to a long-running VPS worker that polls Postgres with atomic
  `QUEUED → RUNNING` claims.
- **IRT math that won't silently inflate mastery.** Bayesian posteriors are unit
  tested with hand-computed values; "I don't know" and "Skip" produce the same
  `correctness` but *different* confidence penalties, rewarding honesty.
- **No theme flash on first paint.** A pre-hydration inline script sets the dark
  class during SSR so there's no light-then-dark flicker.

---

## 16. Future Work

**Currently implemented** (hackathon scope): single-user diagnosis on PDF/DOCX/
PPTX, Knowledge Graph, 4-phase diagnosis (DIAGNOSE → LEARN → PRACTICE → VERIFY),
Knowledge Map, adaptive timeline, history, EN/ES i18n, PWA, GDPR export, tests.

**Future ideas** (explicitly *not* shipped yet):

- Performance: reduce worker latency and cold starts so the platform feels
  faster end-to-end.
- Public landing polish: a sharper hero, clearer CTAs, and SEO tuning before
  going wide.
- OCR for scanned / image-only PDFs (currently surfaced as "we can't read this
  one yet").
- Multi-document workspaces - merge a learner's whole corpus into one graph.
- Collaborative maps (share a snapshot, let a mentor review your gaps).
- API for educators ("diagnose my cohort on *this* material").
- React Native app (PWA-first until retention is proven).
- Billing / subscription tiers (single-tier today; deferred until product-market
  fit).
- OpenTelemetry traces around Brain calls and PostHog analytics wiring.
- Replace the minimal service worker with Serwist for richer caching.

---

## 17. Hackathon

**Built for the Prometheus July AI Challenge.**

MindMap aligns with the judging criteria:

- **Educational Impact** - it targets the actual bottleneck in self-study: the
  illusion of competence. By measuring mastery per concept and surfacing gaps
  honestly, it turns reading into insight and turns flashcards into a *targeted*
  review rather than a blanket one.
- **Creative Use of AI** - AI is the diagnostic core (concept extraction, graph
  generation, adaptive question generation, semantic evaluation, Socratic
  clarification), not a bolt-on chat box. The provider-independent router and
  versioned-prompt library make model swaps a config change.
- **Technical Execution** - a strict 12-package monorepo with enforced import
  boundaries, an AI-only package, schema-validated LLM outputs with repair
  retries, IRT + Bayesian estimation with unit tests, SSE + polling fallback, a
  VPS worker for long-running jobs, Vitest + Brain native tests, and a live
  deploy.
- **Pitch & Demo** - a live demo, a launch video, and a 9-scene hyperframes video
  (`video/`, `apps/web/src/app/[locale]/demo/video/)`) showing every stage of
  the loop in the product's own design tokens.

---

## 18. Author

**Ferran Azpiazu Adrover** - `<cto@mindmap.app>`

---

## License

Proprietary - all rights reserved.