# MindMap — Implementation Roadmap

> Eight phases. Each phase is independently shippable and **must leave the repository
> compiling** (`pnpm typecheck && pnpm lint && pnpm build` all green) before the next
> phase begins. Every phase declares its goal, deliverables, acceptance criteria, risks,
> complexity, and dependencies.

Complexity scale: ●○○○ trivial · ●●○○ moderate · ●●●○ hard · ●●●● very hard.

---

## Phase 1 — Foundation

**Goal** A deployable monorepo with auth, database, design system, PWA, and a premium
landing page. Zero business features yet — everything that follows builds on this.

### Deliverables

- `pnpm` workspace + Turborepo + `turbo.json` (build / typecheck / lint / dev / test
  pipelines, all cached).
- `apps/web` (Next.js 16, App Router, RSC by default).
- 10 packages stubbed with correct `package.json` `exports` + TS project references:
  `brain, ui, database, auth, config, types, shared, parser, analytics, prompts`.
- Shared ESLint flat config + Prettier + `lint-staged` + Conventional Commits.
- `packages/config`: `tsconfig` base, Tailwind v4 preset, ESLint rules with
  `import/no-cycle` + `no-restricted-imports` enforcing the dependency graph from
  `architecture.md` §2.
- `packages/types`: Zod schemas for `User, Workspace, Document, Concept,
KnowledgeGraph, DiagnosisSession` — the domain contract.
- `packages/database`: Prisma schema from `database.md`, Neon connection, first
  migration applied, seed script (1 demo user + 1 sample graph).
- `packages/auth`: Better Auth config (Google OAuth + Resend magic-link), session
  middleware helper.
- `packages/ui`: Tailwind v4 theme tokens from `ui.md`, shadcn primitives (Button,
  Card, Input, …), `EmptyState`, `CalmProgress`, `StatusBadge`, `LocaleSwitch`
  composites.
- `apps/web`: next-intl (`/en`, `/es`) with namespace-split catalogs, locale
  middleware, `manifest.ts` (PWA), service worker via `next-pwa` (offline shell).
- Landing page (`(marketing)/`): hero + 3-step explainer + CTA, fully static,
  OG image, JSON-LD `SoftwareApplication`.
- `/api/health` route.
- Vercel project configured; preview deploys use Neon branching.

### Acceptance Criteria

1. `pnpm install && pnpm build` green from a clean clone.
2. `pnpm typecheck && pnpm lint` zero errors, zero `any`.
3. A new user signs in with Google and lands on `/onboarding` (or their workspace if
   they already have one).
4. Magic-link email arrives within 30s; clicking logs in.
5. `/en` and `/es` both render with localized strings; missing keys fail the build.
6. Lighthouse: Landing SEO + Performance ≥90 on desktop.
7. Lighthouse PWA category installable.
8. `vercel preview` deploy creates a Neon branch automatically; migrations apply.

### Risks

- **Next 16 / React 19 / Better Auth / Prisma generator incompatibility.** _Mitigation:_
  pin patch versions at scaffold; `package.json` `overrides` for transitive React 18
  leaks; if Better Auth is incompatible, fall back to Auth.js (compatibility shim kept
  in `packages/auth`).
- **Tailwind v4 + shadcn/ui initial friction** (shadcn historically targeted v3).
  _Mitigation:_ use shadcn's v4-compatible CLI; theme tokens via `@theme` block.
- **next-pwa maintenance status.** _Mitigation:_ if `next-pwa` doesn't support Next 16,
  switch to a manual service worker via `serwist` (kept as a documented fallback).

### Complexity

●●●○ (lots of wiring, low algorithmic difficulty)

### Dependencies

None — this is the foundation.

---

## Phase 2 — Onboarding, Workspaces, Navigation, Settings

**Goal** The user has a "Mind" to put things in, and can move around the app
intuitively. The shell of the product exists.

### Deliverables

- Onboarding flow: 3 steps (`purpose`, `confidence calibration`, `name your Mind`),
  Framer Motion horizontal-step transitions, "Not now" skippers with sensible defaults.
- `Workspace` CRUD (only create + rename + delete; one workspace auto-created on
  onboarding completion).
- Authenticated app shell: sidebar (Minds list, nav), bottom tab on mobile, top bar
  with locale switch + avatar menu.
- "Your Mind" workspace view: empty state, document list (empty for now), status
  badges wired to `Document.status` (no documents yet, but the UI exists).
- Settings: account (email, sign out, request data export — stub endpoint, GDPR
  scaffold), language, theme (system/light/dark), delete account (soft delete).

### Acceptance Criteria

1. A P3 (judge) completes onboarding in <40s and lands on a named Mind.
2. Empty states render correctly for a fresh workspace.
3. Sidebar navigation works on `md+`; bottom tab on `< md`.
4. Theme toggle persists (cookie + DB `User.locale` + a `theme` column or
   `localStorage` — TBD in implementation, cookie is preferred for SSR consistency).
5. Language toggle updates all strings without a full reload.
6. Sign out returns to Landing; sign back in resumes at the right workspace.

### Risks

- **Onboarding feels like a form.** _Mitigation:_ one input per step, big friendly
  copy, progress as a thin line not a stepper; user-test the copy with at least 2
  people before merging.
- **Theme flash on first paint.** _Mitigation:_ inline script in `<head>` setting the
  class from cookie before hydration (the standard no-flash pattern).

### Complexity

●●○○

### Dependencies

Phase 1.

---

## Phase 3 — Document Upload, Storage, Parser

**Goal** Users can drop a PDF/PPTX/DOCX and the system extracts a structured
representation, with a calm streaming-progress UX.

### Deliverables

- `packages/parser`: adapter interface + concrete adapters
  - PDF: `pdf-parse` (text-layer) + `pdfjs-dist` (page count).
  - PPTX: `pptxtojson` or `mammoth`-equivalent for Open XML.
  - DOCX: `mammoth`.
  - All adapters return a unified `ParsedDocument { chunks, metadata, language }`.
  - Future-format hook: a registry keyed by MIME type.
- `apps/web`: `POST /api/uploads` issues a Vercel Blob signed URL (5-min TTL,
  single-use, MIME allow-list). Client PUTs directly to Blob.
- Upload UI: drag-drop + click, multi-file, 25 MB cap, calm validation messages.
- `Job` row created on upload; client polls `Job.status` + `progress` via React Query
  (1.5s interval, paused when tab hidden).
- Document processing Route Handler: `waitUntil`-backed; writes `DocumentChunk` rows,
  updates `Document.status` through `QUEUED → PARSING → GRAPHING` (graphing happens in
  Phase 4 — for now `PARSING → READY`).
- Streaming progress narrative UI: a sequence of calm status lines ("Extracting
  text…", "Reading chapter 3…") driven by `Job.progress` milestones.

### Acceptance Criteria

1. Upload a 20-page text-based PDF; reaches `READY` in ≤45s median.
2. Upload a `.docx` and a `.pptx`; both parse to `DocumentChunk` rows with non-empty
   `text`.
3. Upload a `.png`; rejected with a calm inline message, no error page.
4. Upload a 30 MB PDF; rejected upfront with the size cap message.
5. Close the laptop mid-parse; reopen → status correctly resumes (DB is the source of
   truth, not in-memory).
6. Scanned (no-text) PDF detected and surfaced as "we can't read this one yet" (OCR is
   a Horizon 2 feature).

### Risks

- **Serverless `maxDuration` (300s) hit on large docs.** _Mitigation:_ 25 MB cap +
  architecture ready for `JobRunner` → Inngest swap (Phase 7).
- **PPTX parsing libs are uneven in quality.** _Mitigation:_ parse text-only first
  (skip embedded images / charts); MVP needs text, not fidelity.
- **Vercel Blob CORS.** _Mitigation:_ configure allowed origins per environment.

### Complexity

●●●○

### Dependencies

Phase 1 (DB, auth), Phase 2 (workspace shell to upload into).

---

## Phase 4 — Brain: Router, Providers, Knowledge Graph

**Goal** The Brain package becomes real. Uploading a document now produces a
`KnowledgeGraph` (concepts + dependencies), still without asking questions.

### Deliverables

- `packages/brain`: full structure from `brain.md` §1.
- `ProviderAdapter` + `zen.ts` + `go.ts` via `@ai-sdk/openai-compatible`; env-driven
  base URLs + keys; token bucket per provider.
- `Router` with policy table from `brain.md` §3; cost guard + daily budget per user.
- `packages/prompts`: initial prompt set (`classify.language`, `extract.structure`,
  `extract.metadata`, `extract.relationships`, `summarize.concept`), versioned, with
  loader.
- `KnowledgeEngine`: pipeline from `brain.md` §5 (classify → structure → metadata →
  concepts → relationships → validate → persist). Schema-repair retry (max 2), cycle
  rejection.
- Wire Phase 3's `GRAPHING` step to `Brain.knowledge.buildGraph`; persist `Concept` +
  `ConceptDependency` rows.
- Document status now goes `PARSING → GRAPHING → READY` truthfully.
- UI: a "graph built" calm notification; the workspace document card shows concept
  count.

### Acceptance Criteria

1. Upload a 30-page textbook PDF; `READY` with ≥20 concepts in ≤90s median.
2. `Concept` rows have non-empty `title` and `summary`; ≥90% parse success.
3. `ConceptDependency` graph is acyclic (validator rejects cycles, drops edges).
4. Router sends `extract.*` and `classify.*` to Zen/DeepSeek-Flash; no Pro provider
   call is made for graph building.
5. A malformed LLM response triggers exactly 1 retry (visible in `ConversationTurn`
   / `AuditEvent`); second failure marks the concept `failed` and continues — partial
   graph is delivered, not a full failure.
6. Daily budget exceeded → "Mind is resting" UX, no 429 leak.

### Risks

- **Provider rate limits during demo bursts.** _Mitigation:_ token bucket + exponential
  backoff; over-budget degrades to "resting" UX, never an error.
- **Prompt regression after edits.** _Mitigation:_ prompt files are versioned; an
  integration test runs the knowledge engine against a fixture PDF with a mock provider
  and asserts the expected graph shape.
- **Schema-repair loops burning tokens.** _Mitigation:_ hard cap of 2 retries; on second
  failure the concept is dropped, not retried.

### Complexity

●●●● (the most algorithm-heavy phase alongside Phase 5)

### Dependencies

Phase 1 (types, DB), Phase 3 (parser output as input).

---

## Phase 5 — Adaptive Diagnosis, Conversation, Evaluation, Knowledge Model

**Goal** The signature experience. Users answer adaptive questions; their knowledge
state evolves and is persisted.

### Deliverables

- `EvaluationEngine`: IRT 1PL next-question selection (Fisher information), Bayesian
  update of `(mastery, confidence)`, stopping rule, neighbor propagation.
- `ConversationEngine`: clarification loop with SSE streaming; bounded to 1
  clarification/question, 3/session.
- `Memory`: session windowing (last 8 turns + summary), `ConceptState` recall.
- `packages/prompts`: `reason.diagnose.easy`, `reason.diagnose.hard`, `reason.evaluate`,
  `reason.clarify`.
- `apps/web`: `POST /api/diagnosis/stream` (SSE, Node runtime, `maxDuration=60`) +
  `GET /api/diagnosis/[id]` polling fallback. Client uses `EventSource`; on 2
  consecutive connection failures, switches to React Query polling.
- Diagnosis UI: one question at a time, MCQ or free-text, "I don't know" / "Skip" as
  first-class actions, micro-feedback line, calm progress ring (no count of questions),
  "Mind is thinking" status states.
- On completion: `Document.status → MAPPED`; `DiagnosisSession.finishedAt` set;
  `ReviewPlan` generated (Phase 6 will consume).
- Unit tests for: IRT math, Bayesian update (grid), stopping rule, neighbor
  propagation, cycle detection (already from Phase 4).

### Acceptance Criteria

1. Diagnose a 30-concept doc; completes in ≤12 questions median with `global_confidence ≥ 0.7`.
2. Probed vs unprobed concepts' mastery values differ by ≥0.15 (probing has signal).
3. "I don't know" lowers mastery but raises confidence; "Skip" lowers confidence only.
4. SSE delivers tokens incrementally; client `EventSource` reconnects once on drop; on
   second drop, polling takes over and the session resumes from `DiagnosisSession`
   state.
5. Browser tab closed mid-diagnosis → reopening resumes from the last persisted turn.
6. `pnpm test` covers IRT + Bayesian + scheduler math; all green.

### Risks

- **IRT math bugs silently inflate mastery.** _Mitigation:_ unit tests with hand-computed
  posteriors; property-based tests (mastery monotonic in correct answers).
- **SSE disconnects on flaky demo wifi.** _Mitigation:_ the fallback is part of the
  contract, not a patch; the UX explicitly says "Reconnecting…" rather than failing.
- **Primary provider (Go) unavailable day-of.** _Mitigation:_ router falls back to
  Zen for `reason.*` if Go is unreachable during the demo.

### Complexity

●●●●

### Dependencies

Phase 4 (Brain, knowledge graph as input), Phase 2 (workspace shell to host the
diagnosis route).

---

## Phase 6 — Knowledge Map, Timeline, History

**Goal** The visual payoff. Users see their mind mapped, and have a personalized review
schedule.

### Deliverables

- `KnowledgeMap` client component: `react-flow` (dynamic import, no SSR), custom
  `ConceptNode` (mastery color, confidence ring opacity, priority badge), edges =
  dependencies.
- Filters: "What I know", "What I think I know", "What I don't", "About to forget" —
  implemented as Framer Motion `layout` transitions that re-pack the visible subgraph.
- Node side panel: full state (mastery, confidence, attempts, lastSeen, dependencies,
  review recommendation).
- Completion animation: staggered cascade of node color fills (50ms/node, capped at
  1.5s) when the diagnosis finishes — the product's hero moment.
- `TimelineEngine` from `brain.md` §8 (pure math, no LLM). Generates `ReviewPlan` +
  `ReviewSession`s grouped by day, ≤10 items each.
- Timeline UI: daily view (Today / Upcoming), `ReviewItem` with reason ("decay",
  "new weakness", "dependency gap"), "Start review" action that opens a constrained
  diagnosis session.
- History view: list of past `DiagnosisSession`s + `ReviewSession`s with date, doc,
  delta in global confidence.
- Mobile fallback for the map: vertical `ConceptList` with the same encoding +
  "Open on a larger screen" hint.

### Acceptance Criteria

1. A 60-concept map renders in ≤1.5s; pan/zoom ≥60fps on a 2020 mid-range laptop.
2. Filters visually partition without overlap or clutter.
3. Side panel opens on node click; keyboard arrow navigation works between nodes.
4. After diagnosis, exactly one `ReviewSession` is scheduled within 24h.
5. Missed reviews do not stack — intervals soften (no punitive doubling).
6. History view shows the last 10 sessions with correct confidence deltas.
7. On `< md`, map degrades to list view gracefully; no horizontal scroll.

### Risks

- **react-flow performance with 200+ nodes.** _Mitigation:_ MVP caps at ~80 concepts
  per doc (Brain truncates beyond that with a "showing top 80 by importance" note);
  virtualization is react-flow's built-in.
- **Completion animation feels gratuitous.** _Mitigation:_ it's the only "rich" motion
  in the app and lasts <1.5s; `prefers-reduced-motion` collapses it to a single fade.

### Complexity

●●●○

### Dependencies

Phase 5 (knowledge state to visualize + schedule from).

---

## Phase 7 — Polish, Accessibility, Animations, SEO, Performance, Testing, Docs

**Goal** Production-grade quality bar. The difference between "hackathon demo" and
"real SaaS".

### Deliverables

- **Accessibility:** `axe-core` in CI (zero critical violations), manual VoiceOver /
  TalkBack pass on the diagnosis flow + map, full keyboard nav, `prefers-reduced-motion`
  honored everywhere, color-contrast audit on all states.
- **Performance:** Lighthouse ≥90 (Performance + SEO + Accessibility) on Landing and
  Workspace; bundle analysis (`@next/bundle-analyzer`) — react-flow code-split,
  no >200KB routes; LCP ≤2.5s on 4G slow.
- **SEO:** per-locale sitemaps, `robots.txt`, OG image per route (dynamic
  `ImageResponse`), JSON-LD `SoftwareApplication` + `FAQPage`, canonical URLs, no
  duplicate-content between locales (`hreflang`).
- **Animations:** final Framer Motion pass — remove any motion that doesn't earn its
  place; ensure every transition uses the tokens from `ui.md`.
- **Testing:** Vitest unit tests for Brain math, parser adapters, scheduler; React
  Testing Library for the onboarding + diagnosis flows; Playwright E2E for
  the critical path (sign in → upload → diagnose → see map); a
  `pnpm test:live` task gated on env vars for real provider calls.
- **Observability:** structured logs (`pino`-like via Vercel's logger), error tracking
  (Sentry candidate — final choice in this phase), OpenTelemetry spans around Brain
  calls.
- **Documentation:** `README.md` (setup, env, deploy), `CONTRIBUTING.md` (Conventional
  Commits, branch model), `AGENTS.md` (commands for AI tooling: `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, `pnpm dev` with port `3100`), inline architectural
  decision records (ADRs) in `docs/adr/` for the contentious choices.
- **Security pass:** CSP audit, dependency audit (`pnpm audit`), secret-scan
  (`gitleaks` in CI), no PII in logs.
- **GDPR scaffold:** data export endpoint (already stubbed in Phase 2) wired to a real
  export job; account deletion honors soft-delete + 30-day purge.

### Acceptance Criteria

1. `pnpm test` (unit + integration) green; `pnpm test:e2e` green against a preview
   deploy.
2. Lighthouse: all key routes ≥90 on the four pillars.
3. `axe-core` CI: zero critical/serious violations.
4. `pnpm audit`: zero high/critical vulnerabilities, or documented exceptions.
5. ADRs exist for: provider choice (Zen/Go), storage (Blob), SSE+fallback, IRT,
   Prisma+Neon.
6. `AGENTS.md` lists the exact commands to typecheck/lint/test/build — so any future
   AI agent (or contributor) doesn't have to guess.
7. Fresh-clone → `pnpm install && pnpm dev` works on port `3100` with no manual env
   beyond `.env.example` copied to `.env`.

### Risks

- **Polish is unbounded.** _Mitigation:_ timeboxed to a fixed pre-demo window; we ship
  the must-haves above and explicitly defer the rest to a `docs/post-hackathon.md`.
- **E2E flakiness on Vercel preview.** _Mitigation:_ Playwright retries + a dedicated
  preview environment for E2E, not the PR preview itself.

### Complexity

●●●○

### Dependencies

All previous phases.

---

## Cross-Phase Invariants (must hold after every phase)

1. `pnpm typecheck && pnpm lint && pnpm build` green on `main`.
2. No `any` types; no `eslint-disable` without a comment explaining why.
3. No provider key on the client; no AI SDK import outside `packages/brain`.
4. Every user-facing string lives in `messages/{locale}/{namespace}.json`.
5. Every DB write validated by a Zod schema at the boundary.
6. Every phase deployed to a Vercel preview before merge to `main`.
7. `AGENTS.md` updated whenever a new developer command is added.

---

## Suggested Phase Ordering for the Hackathon

Phases 1 → 6 are required for a credible demo. Phase 7 is "as much as time allows",
prioritized in this order: **a11y on the diagnosis flow → E2E test for the demo path →
SEO + OG → Lighthouse pass → observability → the rest**. If time runs short, a working
accessible demo with an E2E safety net beats a polished-but-fragile one.
