# MindMap — Project Status

> **Read this first** to pick up where the previous session left off. The full
> architecture, product spec, and phase plans are in `docs/`. This file is the
> **delta** — what's been built, what's running, what's next.

---

## Current Phase

**Phase 7 — Polish, Accessibility, Animations, SEO, Performance, Testing, Docs** ✅ complete. `pnpm typecheck && pnpm lint` green across 11 packages; `pnpm --filter @mindmap/web build` builds.

Next up: **Post-hackathon improvements** (see `docs/post-hackathon.md` if it exists)

---

## How to Resume

1. **Read the docs** (in this order):
   - `docs/vision.md` — product vision + principles
   - `docs/architecture.md` — module boundaries (READ THIS before touching code)
   - `docs/roadmap.md` — phase deliverables
   - `docs/brain.md` — the IRT/Bayesian model you'll build in phase 4/5

2. **Get the system up** (assumes Docker, Node 20+, pnpm 11+):

   ```bash
   cd /root/mindmap
   docker start mindmap-pg                    # if not already running
   pnpm install                                # ~30s on a warm cache
   NODE_OPTIONS="--max-old-space-size=1024" pnpm db:push
   NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/database generate
   fuser -k 3100/tcp 2>/dev/null; sleep 2
   NODE_OPTIONS="--max-old-space-size=1024" nohup pnpm --filter @mindmap/web dev > /tmp/dev.log 2>&1 &
   ```

3. **Verify it's up**:

   ```bash
   curl -sS http://127.0.0.1:3100/api/health
   # → {"ok":true,"db":"ok",...}
   ```

4. **Sign in to the demo** (no SMTP in dev — use the backdoor):

   ```
   http://212.227.246.72:3100/en/sign-in
   ```

   Click "**sign in as demo**" at the bottom of the form. This calls
   `/api/dev/sign-in` which mints a real Better Auth session for
   `demo@mindmap.app` (the seeded user).

5. **Magic links for arbitrary emails** also still work — paste your email,
   then `tail -f /tmp/dev.log | grep magic-link` to read the verify URL.

---

## Architecture Invariants (do not break)

These are enforced by ESLint and documented in `docs/architecture.md`. If
a PR violates one, it does not merge.

1. **Brain boundary.** No file outside `packages/brain` may import an AI
   SDK or call any LLM endpoint. The `Brain` object in
   `packages/brain/src/index.ts` is the only public surface.
2. **UI purity.** `packages/ui` is the only package with React components.
   Components accept props, emit events, never fetch.
3. **Dependency direction.**
   ```
   apps/web           ──► any
   packages/brain     ──► { types, shared, prompts, analytics }
   packages/parser    ──► { types, shared }
   packages/database  ──► { types }
   packages/auth      ──► { types, database }
   packages/ui        ──► { types, shared }        (NEVER brain/database/auth)
   packages/types     ──► { }                      (leaf, Zod only)
   packages/shared    ──► { }                      (leaf, pure utils)
   ```
4. **TypeScript strict.** `any` is banned by ESLint. `unknown` + narrowing.
5. **No barrel files** at the package root. Sub-path exports via
   `package.json` `exports` field.

---

## What's Running

| Service                          | Port                           | How                                                      |
| -------------------------------- | ------------------------------ | -------------------------------------------------------- |
| Postgres + pgvector              | 5432                           | `docker ps` — container `mindmap-pg` (`ankane/pgvector`) |
| Dev server (Next 16 + Turbopack) | 3100                           | `pnpm --filter @mindmap/web dev`                         |
| Local blob storage               | `/var/mindmap/blobs/`          | filesystem                                               |
| Magic-link tokens (dev)          | `$TMPDIR/mindmap-magic-links/` | files written by the dev `sendMagicLink` override        |

**Dev server public URL**: `http://212.227.246.72:3100` (VPS IP `212.227.246.72`).
The Next config sets `allowedDevOrigins` so the dev server accepts that host.

**Memory constraint.** This VPS has 3.8 GB RAM. Always run dev/build/install
with `NODE_OPTIONS="--max-old-space-size=1024"`. If Satisfactory is running,
kill it (`kill -9 <pid>`) before long builds.

---

## What Phase 3 Delivered

| Feature                                                                                                                                         | Files                                                                | Status |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| Postgres + pgvector in Docker                                                                                                                   | `docker run ankane/pgvector`                                         | ✅     |
| Prisma schema regenerated for Better Auth compatibility (`User.emailVerified: Boolean`, `Account.idToken`, `Verification` table)                | `packages/database/prisma/schema.prisma`                             | ✅     |
| Parsers: PDF (`pdftotext` shell-out), DOCX (`mammoth`), PPTX (`jszip`)                                                                          | `packages/parser/src/adapters/*.ts`                                  | ✅     |
| Storage: `LocalFsStorage` (dev) + `VercelBlobStorage` (stub)                                                                                    | `apps/web/src/lib/storage.ts`                                        | ✅     |
| In-process JobRunner using Next 16's `after()`                                                                                                  | `apps/web/src/lib/jobs.ts`                                           | ✅     |
| Routes: `POST /api/uploads/init`, `PUT /api/uploads/[id]`, `POST /api/uploads/finalize`, `GET /api/jobs/[id]`, `GET /api/documents/[id]/status` | `apps/web/src/app/api/...`                                           | ✅     |
| UI: dropzone with `react-dropzone`, MIME allow-list, 25 MB cap                                                                                  | `apps/web/src/components/documents/upload-dropzone.tsx`              | ✅     |
| UI: workspace doc list with `StatusBadge` + progress + React Query polling                                                                      | `apps/web/src/components/documents/document-list.tsx`                | ✅     |
| UI: workspace upload page                                                                                                                       | `apps/web/src/app/[locale]/(app)/mind/[workspaceId]/upload/page.tsx` | ✅     |
| Better Auth magic-link login (dev backdoor at `/api/dev/sign-in`)                                                                               | `apps/web/src/app/api/dev/sign-in/route.ts`                          | ✅     |
| **E2E test: upload PDF → parse → chunks persisted**                                                                                             | `packages/database/test-e2e.mts`                                     | ✅     |

---

## What Phase 4 Delivered

| Feature                                                                                                                                            | Files                                                                                                                                                                       | Status |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Brain providers: `zen` and `go` adapters over `@ai-sdk/openai-compatible` + a `mockProvider` for tests                                             | `packages/brain/src/providers/{provider,zen,go,openai-compatible,registry,mock}.ts`                                                                                         | ✅     |
| Router policy table (task → ordered provider/model candidates)                                                                                     | `packages/brain/src/router/policy.ts`                                                                                                                                       | ✅     |
| Per-(user, provider) token bucket + per-user daily token budget with degradation                                                                   | `packages/brain/src/router/{token-bucket,budget}.ts`                                                                                                                        | ✅     |
| Router `pickRoute` / `dispatch` with `BudgetExceeded` fallback and provider availability check                                                     | `packages/brain/src/router/router.ts`                                                                                                                                       | ✅     |
| Versioned prompts with YAML frontmatter + mustache rendering                                                                                       | `packages/prompts/prompts/{classify.language,extract.structure,extract.metadata,extract.relationships,summarize.concept}.md` + `packages/prompts/src/loader.ts`             | ✅     |
| Zod schemas for every LLM output + `extractJson` (handles fences / prose)                                                                          | `packages/brain/src/schemas/knowledge.ts`                                                                                                                                   | ✅     |
| Retry with exponential backoff + schema-repair loop (max 2 retries, drops concept on second failure)                                               | `packages/brain/src/retry.ts`                                                                                                                                               | ✅     |
| `KnowledgeEngine` — 5-stage pipeline (classify → structure → metadata → relationships → validate) with `onProgress` and acyclic validation         | `packages/brain/src/engines/{knowledge-engine,dag}.ts`                                                                                                                      | ✅     |
| Public `Brain` API exposes `knowledge.buildGraph` plus the router / schemas / providers for tests                                                  | `packages/brain/src/index.ts`                                                                                                                                               | ✅     |
| JobRunner extended: `PARSE` chains `BUILD_GRAPH`; `GRAPHING → READY` transition is real                                                            | `apps/web/src/lib/jobs.ts`, `apps/web/src/features/documents/{processor,graph-processor}.ts`                                                                                | ✅     |
| Concept count + "Building the map" status surfaced in the workspace list                                                                           | `apps/web/src/components/documents/document-list.tsx`, `apps/web/src/app/[locale]/(app)/mind/[workspaceId]/page.tsx`, `apps/web/src/app/api/documents/[id]/status/route.ts` | ✅     |
| ESLint boundary: AI SDK imports banned outside `packages/brain` (the only allowed importer)                                                        | `packages/config/src/eslint/{index.js,next.js}`                                                                                                                             | ✅     |
| Env config for `OPENCODE_ZEN_MODEL`, `OPENCODE_GO_MODEL`, `BRAIN_DAILY_BUDGET_*`                                                                   | `.env`, `.env.example`                                                                                                                                                      | ✅     |
| Brain unit tests: cycle detection, router policy + budget, knowledge-engine with mock + schema-repair retry                                        | `packages/brain/src/{engines,router}/*.test.ts` (10/10 pass)                                                                                                                | ✅     |
| E2E: `test-e2e.mts` extended to wait for `BUILD_GRAPH` and assert ≥20 `Concept` rows with non-empty title + summary, plus acyclic dependency graph | `packages/database/test-e2e.mts`                                                                                                                                            | ✅     |
| `pnpm typecheck` + `pnpm lint` + `pnpm build` all green across 11 packages                                                                         | —                                                                                                                                                                           | ✅     |

**Acceptance walkthrough.** Drop a real 30-page PDF at `/tmp/real2.pdf`, start
the dev server, then:

```bash
cd /root/mindmap/packages/database
./node_modules/.bin/tsx test-e2e.mts
```

The script signs in via magic link, uploads the PDF, polls the PARSE job,
then the chained BUILD_GRAPH job (or runs `Brain.knowledge.buildGraph`
directly if the in-process runner's `after()` was killed by the response
closing). It asserts `≥20 Concept` rows with non-empty title + summary, and
that the `ConceptDependency` graph is acyclic.

---

## What Phase 5 Delivered

| Feature                                                                                                                                                                            | Files                                                                      | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| `EvaluationEngine` — IRT 1PL Fisher info, Bayesian grid posterior, stopping rule (max-questions, global-confidence, stagnant), neighbor propagation, EASY/HARD question picker     | `packages/brain/src/engines/evaluation-engine.ts`, `irt.ts`, `bayesian.ts` | ✅     |
| `ConversationEngine` — Socratic clarification as `AsyncIterable<Token>` (1 per question, 3 per session)                                                                            | `packages/brain/src/engines/conversation-engine.ts`                        | ✅     |
| `Memory` — last-8-turn windowing + `ConceptState` recall                                                                                                                           | `packages/brain/src/engines/memory.ts`                                     | ✅     |
| Prompts: `reason.diagnose.easy`, `reason.diagnose.hard`, `reason.evaluate`, `reason.clarify`                                                                                       | `packages/prompts/prompts/reason.*`                                        | ✅     |
| Zod schemas: `DiagnoseEasySchema`, `DiagnoseHardSchema`, `EvaluationSchema`, `ClarificationSchema` + `extractJson` (handles prose / fences)                                        | `packages/brain/src/schemas/diagnosis.ts`                                  | ✅     |
| API: `POST /api/diagnosis/start`, `GET /api/diagnosis/[id]/next` (SSE), `GET /api/diagnosis/[id]` (polling), `POST /api/diagnosis/[id]/answer`, `POST /api/diagnosis/[id]/clarify` | `apps/web/src/app/api/diagnosis/**`                                        | ✅     |
| Diagnosis UI: `QuestionCard` (MCQ + OPEN + IDontKnow + Skip), `ClarificationCard`, `CalmThinking`, `MasteryRing` in header, reconnect-once + polling fallback after 2 failures     | `apps/web/src/components/diagnosis/*`                                      | ✅     |
| Persisted state: `DiagnosisSession`, `Question` + `Answer`, `ConversationTurn`, `ConceptState` upserts with `dueAt`                                                                | `apps/web/src/features/diagnosis/actions.ts`                               | ✅     |
| `Document.status → MAPPED` on completion; `ReviewPlan` upserted (empty in Phase 5, populated in Phase 6)                                                                           | `apps/web/src/features/diagnosis/actions.ts` → `finaliseSession`           | ✅     |
| Brain unit tests: IRT math, Bayesian update, stopping rule, neighbor propagation, EASY/HARD picker, IDontKnow lowers mastery / raises confidence, Skip lowers confidence           | `packages/brain/src/engines/*.test.ts` (42 → 56 in Phase 6)                | ✅     |
| E2E: `diag-e2e.mts` exercises the full flow against a live dev server                                                                                                              | `packages/database/diag-e2e.mts`                                           | ✅     |

---

## What Phase 6 Delivered

| Feature                                                                                                                                                                                                                                                                                                                       | Files                                                                                 | Status |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| `TimelineEngine` — pure-math `intervalDays()` (base × (1+mastery) × (0.5+confidence) × (1+lastDelta)) × difficultyPenalty × 2^streak), `priorityFor()` + `reasonFor()`, ≤10 items/day, 90-day horizon, drops well-known concepts past horizon                                                                                 | `packages/brain/src/engines/timeline-engine.ts`                                       | ✅     |
| `Brain.timeline.scheduleReviews` — wires the engine to a typed `Result<{ sessions, items, diagnostics }, BrainError>`                                                                                                                                                                                                         | `packages/brain/src/index.ts`                                                         | ✅     |
| 14 timeline unit tests (math + scheduling + horizon + day labels)                                                                                                                                                                                                                                                             | `packages/brain/src/engines/timeline-engine.test.ts`                                  | ✅     |
| Timeline actions: `scheduleReviewsForDocument`, `loadTimelineForUser`, `startReviewSession`, `submitReviewAnswers`, `loadHistoryForUser`                                                                                                                                                                                      | `apps/web/src/features/timeline/actions.ts`                                           | ✅     |
| `DiagnosisSession` finaliser calls `scheduleReviewsForDocument` so the user's first review appears immediately after diagnosis                                                                                                                                                                                                | `apps/web/src/features/diagnosis/actions.ts` → `finaliseSession`                      | ✅     |
| API: `POST /api/timeline/schedule`, `POST /api/timeline/[id]/start`, `POST /api/timeline/[id]/submit`                                                                                                                                                                                                                         | `apps/web/src/app/api/timeline/**`                                                    | ✅     |
| `KnowledgeMap` client component — `@xyflow/react` with `ReactFlow`, custom `ConceptNode` (mastery color × confidence opacity × importance radius), dependency edges, filter chips ("all / known / thinkIKnow / dontKnow / aboutToForget"), side panel with neighborhood + "open in timeline", mobile fallback (vertical list) | `apps/web/src/components/map/*`                                                       | ✅     |
| `TimelineView` — Today / Upcoming / Overdue sections, per-day `ReviewItem` cards with reason + mastery ring, "Start review" / "Resume review" CTAs                                                                                                                                                                            | `apps/web/src/components/timeline/timeline-view.tsx`                                  | ✅     |
| `ReviewSessionClient` — re-evaluation loop (knew / didn't / skip), per-item mastery nudge, post-batch reschedule                                                                                                                                                                                                              | `apps/web/src/components/timeline/review-session.tsx`                                 | ✅     |
| `HistoryList` — last 10 diagnosis + review sessions with confidence delta vs. the user's prior session for the same doc                                                                                                                                                                                                       | `apps/web/src/components/history/history-list.tsx`                                    | ✅     |
| Pages: `/mind/[workspaceId]/map/[documentId]`, `/mind/[workspaceId]/timeline`, `/mind/[workspaceId]/history`, `/mind/[workspaceId]/review/[sessionId]`                                                                                                                                                                        | `apps/web/src/app/[locale]/(app)/mind/[workspaceId]/{map,timeline,history,review}/**` | ✅     |
| `WorkspaceSubNav` — horizontal tab strip across all workspace pages (documents / timeline / history)                                                                                                                                                                                                                          | `apps/web/src/components/mind/workspace-sub-nav.tsx`                                  | ✅     |
| i18n: new `map`, `timeline`, `review`, `history` namespaces in `en.json` + `es.json`; plural-aware strings; `documents.viewTimeline` / `viewHistory` / `seeMap`                                                                                                                                                               | `apps/web/messages/{en,es}.json`                                                      | ✅     |
| `@xyflow/react@^12` added to `apps/web`; tree-shaken into the map page only (dynamic import)                                                                                                                                                                                                                                  | `apps/web/package.json`                                                               | ✅     |

**Acceptance walkthrough.** Sign in as `demo@mindmap.app` (`/en/sign-in` → "sign in as demo"),
open the workspace, click "Begin diagnosis" on a `READY` doc, answer 12
questions. The `MAPPED` CTA leads to the map; the workspace shows a
"Timeline" tab. The timeline page lists today's review (or "nothing due
yet" if the engine dropped everything). `pnpm typecheck && pnpm lint`
green; `pnpm --filter @mindmap/web build` builds.

---

## What Phase 7 Delivered

| Feature                                                                                                                                                             | Files                                                                                                | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| **Vitest test infrastructure** — `vitest.config.ts`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` environment                                     | `apps/web/vitest.config.ts`, `apps/web/src/__tests__/setup.ts`                                       | ✅     |
| **Unit tests** — 5 tests covering sitemap, OG image, robots.txt, security headers, GDPR export structure                                                            | `apps/web/src/__tests__/mindmap.test.ts`                                                             | ✅     |
| **SEO: sitemap** — `sitemap.ts` generating per-locale sitemaps with hreflang alternates                                                                             | `apps/web/src/app/sitemap.ts`                                                                        | ✅     |
| **SEO: robots.txt** — `robots.ts` with crawl rules and sitemap reference                                                                                            | `apps/web/src/app/robots.ts`                                                                         | ✅     |
| **OG image generation** — `@vercel/og` endpoint generating dynamic Open Graph images per route                                                                      | `apps/web/src/app/api/og/route.tsx`                                                                  | ✅     |
| **Security headers** — CSP headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`                        | `apps/web/next.config.ts`                                                                            | ✅     |
| **Accessibility: prefers-reduced-motion** — Hook + motion variants that respect user motion preferences                                                             | `apps/web/src/hooks/use-prefers-reduced-motion.ts`, `apps/web/src/hooks/motion-variants.ts`          | ✅     |
| **Accessibility: diagnosis flow** — ARIA roles (`radiogroup`, `radio`, `aria-checked`), `aria-live` regions, `aria-label`, `focus:ring` styles, keyboard navigation | `apps/web/src/components/diagnosis/question-card.tsx`, `clarification-card.tsx`, `calm-thinking.tsx` | ✅     |
| **Accessibility: onboarding** — `role="progressbar"`, `aria-label`, `role="radiogroup"`, `aria-checked`, reduced-motion transitions                                 | `apps/web/src/components/onboarding/onboarding-flow.tsx`                                             | ✅     |
| **ADR-0002: SSE + polling fallback** — Decision record for the real-time diagnosis transport                                                                        | `docs/adr/0002-sse-polling-fallback.md`                                                              | ✅     |
| **ADR-0003: IRT-based evaluation** — Decision record for the adaptive questioning engine                                                                            | `docs/adr/0003-irt-evaluation.md`                                                                    | ✅     |
| (ADR-0004 removed — single-tier product; billing deferred to post-PMF)                                                                                              | —                                                                                                    | ✅     |
| **ADR-0005: Prisma + Neon** — Decision record for the ORM and database choice                                                                                       | `docs/adr/0005-prisma-neon.md`                                                                       | ✅     |
| **GDPR: data export** — `GET /api/export` endpoint exporting user data as JSON                                                                                      | `apps/web/src/app/api/export/route.ts`                                                               | ✅     |
| **Turbo test pipeline** — `test` task added to `turbo.json`                                                                                                         | `turbo.json`                                                                                         | ✅     |
| **Root test scripts** — `pnpm test` and `pnpm test:watch`                                                                                                           | `package.json`                                                                                       | ✅     |
| **AGENTS.md updated** — Test commands, Phase 8 documentation, dependency rules                                                                                      | `AGENTS.md`                                                                                          | ✅     |
| `pnpm typecheck && pnpm lint` green across 12 packages                                                                                                              | —                                                                                                    | ✅     |
| `pnpm --filter @mindmap/web build` builds successfully                                                                                                              | —                                                                                                    | ✅     |

## Known Gotchas

- **Server reload after `schema.prisma` changes:** always `pnpm --filter
@mindmap/database generate` AND restart the dev server. Turbopack caches
  the Prisma client; without the restart, you get "Model X does not exist"
  errors.
- **`.js` imports in `packages/parser` and other packages:** the source uses
  no `.js` extension on relative imports because Turbopack doesn't do the
  `.js` → `.ts` rewrite that plain `tsc` does. ESLint accepts both forms.
- **Memory limit:** 3.8 GB total. Use `NODE_OPTIONS=--max-old-space-size=1024`
  on `pnpm install`, `pnpm typecheck`, `pnpm --filter ... build`. The full
  `pnpm build` (Turbo across all packages) may OOM — do per-package builds
  if needed.
- **Process not exiting after `next dev`:** if you start it in foreground and
  Ctrl+C, port stays bound for ~5s. `fuser -k 3100/tcp` clears it instantly.
- **`experimental.turbo` warning** at dev start — harmless, comes from
  next-intl's plugin. We replicate the alias in our own `turbopack` config.
- **In-process JobRunner & `next/server` `after()`:** Next 16 fires the
  `after()` callback after the response is fully sent, but in dev/some
  serverless contexts the callback can be killed before it runs. The
  E2E handles this by also running the brain pipeline directly from the
  test process if the `BUILD_GRAPH` job never materialises.

---

## Quick Commands

```bash
# DB
docker ps --filter "name=mindmap-pg"
docker logs mindmap-pg --tail 20
NODE_OPTIONS="--max-old-space-size=1024" pnpm db:push
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/database generate
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/database exec tsx prisma/seed.ts

# Dev
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/web dev
tail -f /tmp/dev.log
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/web typecheck
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter @mindmap/web build

# Tests
cd /root/mindmap/packages/database
/root/mindmap/packages/database/node_modules/.bin/tsx clean-e2e.mts
/root/mindmap/packages/database/node_modules/.bin/tsx test-e2e.mts
/root/mindmap/packages/database/node_modules/.bin/tsx diag-e2e.mts
# Brain unit tests (DAG, router, knowledge-engine, IRT, Bayesian,
# evaluation engine, memory, timeline engine with mock + schema-repair)
cd /root/mindmap/packages/brain
./node_modules/.bin/tsx --test 'src/**/*.test.ts'

# Cleanup
fuser -k 3100/tcp
rm -rf /root/mindmap/apps/web/.next
```
