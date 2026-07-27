# MindMap — Technical Architecture

> Decisions are justified inline. Where an alternative was seriously considered, it is
> listed under `### Alternatives` with the reason it was rejected.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         apps/web  (Next.js 16)                        │
│  ─ App Router (RSC by default) + Route Handlers + Middleware (edge)   │
│  ─ Server Actions for mutations, Route Handlers for SSE / uploads     │
│  ─ next-intl middleware for /en, /es                                   │
└───────────┬───────────────────────────────────────────┬──────────────┘
            │                                            │
            │  (server-side only)                        │  (server-side only)
            ▼                                            ▼
┌─────────────────────┐                       ┌────────────────────────┐
│  packages/brain     │                       │  packages/parser        │
│  AI Router          │                       │  PDF/PPTX/DOCX → JSON    │
│  Knowledge Engine   │                       └───────────┬────────────┘
│  Evaluation Engine  │                                   │
│  Timeline Engine    │                                   │
│  Conversation Eng.  │                                   │
│  Memory             │                                   │
│  Prompt Library     │                                   │
└────────┬────────────┘                                   │
         │                                                │
         ▼                                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  packages/auth (Better Auth)   packages/database (Prisma → Neon PG)   │
└──────────────────────────────────────────────────────────────────────┘
         │                                                │
         ▼                                                ▼
┌─────────────────────┐                       ┌────────────────────────┐
│  Resend (email)     │                       │  Vercel Blob (uploads)  │
│  Google OAuth       │                       │  Neon Postgres           │
└─────────────────────┘                       └────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  External LLM providers (only ever reached from packages/brain):       │
│   • OpenCode ZEN  →  deepseek-v4-flash   (fallback, cheap tasks)      │
│   • OpenCode GO   →  mimo-2.5-class      (reasoning)                  │
│   both via @ai-sdk/openai-compatible (OpenAI-compatible base URLs)      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Layout

```
mindmap/
├── apps/
│   └── web/                      # Next.js 16 app (the only deployable)
├── packages/
│   ├── brain/                    # AI: router, engines, prompts, memory
│   ├── ui/                       # shadcn/ui-based design system
│   ├── database/                 # Prisma schema, client, migrations, seeds
│   ├── auth/                     # Better Auth config + helpers
│   ├── config/                   # eslint, tsconfig, tailwind preset — shared
│   ├── types/                    # Cross-package domain types (Zod schemas)
│   ├── shared/                   # Pure utils: id, dates, retry, sse helpers
│   ├── parser/                   # Document parsing adapters
│   ├── analytics/                # Event tracking abstraction (noop → PostHog)
│   └── prompts/                  # Versioned prompt templates (consumed by brain)
├── docs/                         # this directory
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                  # root: scripts, packageManager, engines
└── .env.example
```

### Dependency rules (enforced via ESLint `no-restricted-imports` + `import/no-cycle`)

```
apps/web ──► packages/*  (any)
packages/brain ──► { types, shared, prompts, analytics }
packages/parser ──► { types, shared }
packages/database ──► { types }
packages/auth ──► { types, database }
packages/ui ──► { types, shared }              # NEVER brain/database/auth
packages/types ──► { }                          # leaf, Zod-only
packages/shared ──► { }                         # leaf, pure utils
packages/prompts ──► { types }                  # leaf, no DB
packages/analytics ──► { types }
packages/config ──► { }                         # leaf
```

**No business logic inside `packages/ui`.** UI components accept props and emit events.
All data fetching, mutations, and AI calls live in `apps/web` (Server Actions / Route
Handlers / React Query hooks), delegating to `packages/brain` and `packages/database`.

### Alternatives considered

- **Nx over pnpm workspaces + Turborepo.** Rejected: Nx shines for multi-app enterprise
  repos; we have one app. pnpm's strict hoisting + Turborepo's caching cover our needs
  with less config. Nx's generators would impose a project structure we'd fight.
- **Turborepo vs. plain pnpm scripts.** Turborepo's remote cache + topological scheduling
  pays off from phase 2 onward (every `pnpm build` of `packages/ui` triggers downstream
  rebuilds). Worth the single `turbo.json`.

---

## 3. Apps/Web Internal Structure

```
apps/web/
├── app/
│   ├── [locale]/                 # next-intl segment
│   │   ├── (marketing)/          # landing — public, SSG
│   │   ├── (auth)/               # sign-in, magic callback
│   │   ├── (app)/                # authenticated shell
│   │   │   ├── onboarding/
│   │   │   ├── mind/[workspaceId]/         # workspace = "Your Mind"
│   │   │   │   ├── documents/
│   │   │   │   ├── map/[documentId]/       # Knowledge Map view
│   │   │   │   ├── diagnose/[documentId]/  # SSE diagnosis
│   │   │   │   └── timeline/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── api/
│   │   ├── auth/[...all]/        # Better Auth handler
│   │   ├── uploads/              # signed URL issue (POST) + webhook (POST)
│   │   ├── diagnosis/stream/     # SSE (GET/POST)
│   │   ├── diagnosis/[id]/       # polling fallback (GET)
│   
│   └── manifest.ts               # PWA manifest (next-pwa)
├── components/
│   ├── ui/                       # re-export from packages/ui
│   ├── marketing/
│   ├── auth/
│   ├── onboarding/
│   ├── workspace/
│   ├── map/                      # react-flow nodes + edges
│   ├── diagnosis/
│   └── settings/
  ├── features/                     # one folder per cohesive feature
  │   ├── documents/                # hooks, server actions, queries
  │   ├── diagnosis/
  │   ├── knowledge-map/
  │   └── timeline/

  ├── lib/
  │   ├── auth.ts                   # re-export packages/auth
  │   ├── db.ts                     # Prisma client singleton
  │   ├── brain.ts                  # brain client
  │   └── i18n.ts                   # next-intl config

├── middleware.ts                 # i18n + auth + feature-flag edge checks
├── messages/                     # next-intl catalogs
│   ├── en.json
│   └── es.json
└── public/
    ├── icons/                    # PWA icons
    └── og/
```

### Alternatives

- **Single flat `app/` without route groups.** Rejected: route groups `(marketing)`,
  `(auth)`, `(app)` let us share layouts (navbar, footer, locale handling) without
  polluting URLs. Standard Next 16 pattern.
- **Feature-first vs. type-first (`components/`, `hooks/`, `actions/`).** Feature-first
  (`features/documents/...`) keeps cohesion — when you change a document upload rule, you
  touch one folder. Type-first scatters related code across the tree.

---

## 4. Data Flow Patterns

### 4.1 Reads

- **Server Components** fetch via Prisma directly (RSC gives us free streaming + auth
  context). No React Query on the server.
- **Client Components** use **React Query** for polling (status badges, diagnosis
  fallback) and for cacheable mutations invalidated by query keys.

### 4.2 Mutations

- Default: **Server Actions** (typed end-to-end via Zod-validated input).
- SSE / streaming responses: **Route Handlers** (`POST /api/diagnosis/stream`).
- Signed-URL uploads: **Route Handler** `POST /api/uploads` returns a Vercel Blob
  signed URL; the client PUTs directly to Blob — Next server never proxies bytes.

### 4.3 Long-running parsing jobs

- No external queue in MVP. We persist a `Job` row in Postgres with `status` and
  `progress`. The Route Handler that initiates parse kicks off a `waitUntil`-backed
  server function (Vercel's `afterResponse`), writes progress into `Job`, and the client
  polls via React Query (every 1.5s) until `status = ready`.
- **Trade-off:** Serverless functions cap at `maxDuration=300s`. A 100-page scanned PDF
  could exceed this; we reject files >25MB up front and show a calm "this one's too big"
  state. Architecture is ready to swap in **Inngest** or **QStash** by replacing the
  `JobRunner` interface (one file in `packages/shared`).

### Alternatives

- **Inngest from day 1.** Tempting (durable, retries, step functions) but adds a vendor
  and a dev-server to a hackathon. We keep the `JobRunner` interface ready so the swap is
  a one-package change post-MVP.
- **WebSockets instead of SSE.** SSE is unidirectional and works over HTTP/2 with the
  existing Next server; WebSockets require a separate server (or Vercel's pending
  support) and complicate auth. Diagnosis only needs server→client streaming.

---

## 5. Cross-Cutting Concerns

### 5.1 Typing

- **Strict TS** everywhere (`strict: true`, `noUncheckedIndexedAccess: true`).
- Domain types live in `packages/types` as **Zod schemas** that also export inferred TS
  types. Schemas are the single source of truth; both client and server validate with
  them.
- `any` is banned via ESLint; `unknown` + narrowing required.

### 5.2 Validation

- All Server Action inputs validated with Zod at the boundary.
- All AI outputs validated with Zod schemas _before_ being persisted — a malformed LLM
  response triggers a controlled retry (see `brain.md` §10), never a raw write.

### 5.3 Error handling

- `Result<T, E>` pattern in `packages/shared` for expected-domain errors (no throw).
- Unexpected errors throw and bubble to a Next `error.tsx` boundary with a calm UX.
- Server errors log structured fields (`userId`, `traceId`, `feature`) — provider TBD
  in phase 7 (Sentry candidate).

### 5.4 i18n

- `next-intl` with locale segment in the URL (`/en`, `/es`).
- Catalogs split per _namespace_ (`messages/{locale}/{namespace}.json`) — never a single
  giant file. Namespace = feature (`documents`, `diagnosis`, `onboarding`, …).
- ICU MessageFormat for pluralization / gender (Spanish gender is real).
- Adding a locale = drop a folder + update `i18n.ts`. Architecture supports unlimited.

### 5.6 Security

- All provider API keys live only in Vercel env vars, only on the server.
- No `NEXT_PUBLIC_*` for any AI-related value.
- Uploads: signed URLs with short TTL (5 min), single-use, MIME allow-list.
- Auth: Better Auth httpOnly cookie, `sameSite=lax`, `secure` in prod.
- RSC enforces auth at the layout level for `(app)` routes; Server Actions re-check.
- CSP via `next.config.js` `headers()` — `default-src 'self'`, no inline scripts beyond
  Next's own, `connect-src` allow-list (Vercel Blob, Resend, the Zen/Go base URLs).
- **Privacy:** Provider calls set `usage_log: false`-equivalent headers where supported
  (Zen/Go are OpenAI-compatible; we pass `extra_headers` to opt out of training). The raw
  document text is stored only in Neon (encrypted at rest by Neon); never logged.

### 5.7 Performance

- RSC + streaming for first paint of any authenticated page.
- `dynamic = 'force-static'` for marketing pages.
- Knowledge Map is a client component but loads `react-flow` via dynamic import (no SSR)
  to keep the initial bundle lean.
- Fonts: `next/font` (Geist Sans + Geist Mono, self-hosted, no FOUT).
- Images: `next/image` everywhere; OG image generated at build time per route.

---

## 6. The Brain Boundary (summary — full detail in `brain.md`)

The single most important architectural rule:

> **No component, hook, or route outside `packages/brain` is permitted to import any
> AI SDK, provider SDK, or call any LLM endpoint. Violations fail CI.**

`packages/brain` exposes a small surface:

```ts
// packages/brain/index.ts (typed public API)
export const Brain = {
  knowledge: {
    buildGraph(input: ParsedDocument): Promise<KnowledgeGraph>
  },
  evaluation: {
    startDiagnosis(sessionId): AsyncIterable<DiagnosisEvent>
    submitAnswer(sessionId, answer): Promise<KnowledgeStateDelta>
    nextQuestion(sessionId): Promise<Question | null>
  },
  timeline: {
    scheduleReviews(documentId): Promise<ReviewPlan>
  },
  conversation: {
    clarify(sessionId, message): AsyncIterable<Token>
  },
}
```

Every method is provider-independent. Adding a new provider = adding a file under
`packages/brain/providers/` and a row in the router config.

---

## 7. Storage Strategy

| Need                                                                  | Choice                                     | Why                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Relational data (users, workspaces, concepts, jobs, reviews) | **Neon Postgres** via Prisma               | Serverless PG, branching for preview deploys, scales to thousands of users without ops |
| Document binaries (PDF/PPTX/DOCX)                                     | **Vercel Blob**                            | Signed URLs, zero-config, same bill as Vercel, S3-compatible enough for MVP            |
| Extracted text (parsed docs)                                          | **Neon `DocumentChunk` table**             | Queryable, no separate vector DB needed for MVP search                                 |
| Semantic search / RAG (future)                                        | **Neon `pgvector`** (or Turbopuffer later) | Postgres extension keeps the stack single-store; we don't ship RAG in MVP              |
| Sessions / cache                                                      | **Neon** + Better Auth session table       | No Redis dependency in MVP                                                             |

### Alternatives

- **AWS S3 direct for uploads.** More portable across clouds, but introduces IAM, CORS,
  lifecycle policies, and a separate bill. For a Vercel-deployed SaaS MVP, Vercel Blob
  wins on DX. If we outgrow it (cost, region needs), the `StorageProvider` interface
  abstracts the swap.
- **Turso / SQLite.** Lighter, edge-friendly, but lacks `pgvector` and Prisma's full
  feature set. Neon's branching is also a perfect fit for preview deploys.
- **Supabase.** All-in-one, but couples us to their auth + storage + realtime. We've
  chosen Best-of-breed (Better Auth, Vercel Blob, Neon) for portability.

---

## 8. Deployment Strategy

- **Hosting:** Vercel, single project, `apps/web` as root.
- **Branch model:** `main` → production; every PR → preview deployment with its own
  **Neon branch** (via Neon's Vercel integration) and its own Vercel Blob store bucket
  (env-var per deploy).
- **Build:** `turbo build` — caches package builds across PRs.
- **Env vars:** per-environment (Preview / Production). Secrets via Vercel's encrypted
  env; `OPENCODE_ZEN_KEY` and `OPENCODE_GO_KEY` never in preview PRs unless the PR is
  from `main`'s collaborator (branch protection).
- **Database migrations:** `prisma migrate deploy` runs as a Vercel build step on
  non-preview deploys. Preview deploys use Neon branch auto-migration via
  `prisma db push` (no migration history pollution).
- **Healthcheck:** `/api/health` returns `{ ok: true, db: ok, brain: ok }` — used by
  Vercel's monitor and by `apps/web`'s boot sequence.

---

## 9. Coding Standards (enforced in CI)

| Standard          | Tool                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| Formatting        | Prettier (no debate, no per-file config)                                   |
| Linting           | ESLint flat config, `next`, `typescript`, `import`, `jsx-a11y`, `unicorn`  |
| Type-check        | `tsc --noEmit` via `turbo typecheck`                                       |
| Import boundaries | `eslint-plugin-import` `no-restricted-imports` + `import/no-cycle`         |
| Commit hygiene    | Conventional Commits enforced via `commitlint` + `commitizen`-style helper |
| Pre-commit        | `lint-staged` runs Prettier + ESLint on staged files                       |
| CI gates          | typecheck → lint → build → (later) test. All must pass before merge.       |

### Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for components.
- Components: `PascalCase`. Hooks: `useCamelCase`. Server Actions: `camelCaseAction`.
- DB tables: `snake_case`, plural (`documents`, `concepts`, `review_sessions`).
- DB columns: `snake_case`. Prisma models: `PascalCase` singular (`Document`).
- Env vars: `SCREAMING_SNAKE_CASE`. Public-safe ones prefixed `NEXT_PUBLIC_` (we use
  almost none).

### Conventions

- Co-locate tests next to source: `feature.ts` ↔ `feature.test.ts` (Vitest).
- Never `export *`; named exports only.
- No barrel files at the package level (they break tree-shaking and Turbo caching);
  sub-path exports via `package.json` `exports` field instead.
- Comments only when _why_ is non-obvious. Never restate _what_ the code does.

---

## 10. Scalability Decisions

| Concern         | Decision                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Read scaling    | Neon's read replicas (auto-scaling) + RSC streaming minimize TTFB                                               |
| Write scaling   | Neon handles our MVP writes easily; `Job` table indexed on `(status, userId)` for pollers                       |
| AI cost scaling | Router prefers cheap model (Zen/DeepSeek-Flash) for ≥80% of tokens; GO/MiMo is the fallback for diagnosis when needed |
| Multi-tenancy   | `Workspace` row owns all related rows via `workspaceId` FK — every query scopes by it                           |
| Memory (Brain)  | Per-session conversation memory capped (last N messages) + persisted `ConversationTurn` table for long-term     |
| Cold starts     | Brain package is pure functions + lazy provider init; no module-level network calls                             |

---

## 11. Open Architectural Risks

1. **Next 16 + React 19 + Better Auth + Prisma generator compat.** Mitigation: pin
   patch versions at scaffold time; lockfile committed; `package.json` `overrides` for
   transitive React 18 leaks.
2. **Vercel function `maxDuration` vs. large document parse.** Mitigation: 25 MB cap;
   `JobRunner` interface ready for Inngest swap.
3. **SSE through Vercel's edge vs. node runtime.** SSE works on Node runtime; we keep
   `/api/diagnosis/stream` on `runtime = 'nodejs'` with `maxDuration = 60`. Edge runtime
   lacks the streaming primitives we need.
4. **Provider rate limits** on Zen/Go during a hackathon demo burst. Mitigation: token
   bucket in `packages/brain/router.ts` + exponential backoff retry; `429` becomes a
   "the Mind is thinking" UX state, never an error page.

---

## 12. Glossary

- **Mind** = a `Workspace` (user-facing name). One user can have many Minds.
- **Document** = an uploaded file + its parsed graph.
- **Concept** = a node in the Knowledge Graph.
- **Diagnosis** = an adaptive questioning session producing a `KnowledgeState`.
- **Knowledge State** = per-concept `(mastery, confidence, attempts, lastSeen)`.
- **Review Plan** = a scheduled set of re-diagnosis sessions.
