# AGENTS.md

> Operational notes for AI agents (and humans) working in this repo.

## Required commands

Run these **before** any commit or PR. The repo must stay green.

```bash
pnpm install                    # install all workspace deps
pnpm typecheck                  # tsc --noEmit across all packages
pnpm lint                       # ESLint across all packages
pnpm format                     # Prettier write
pnpm format:check               # Prettier check
pnpm build                      # turbo build of all packages
```

## Per-package commands

```bash
# Database (Prisma)
pnpm db:generate                # prisma generate
pnpm db:push                    # push schema to DB (no migration history)
pnpm db:migrate                 # create + apply a migration
pnpm db:seed                    # seed demo data
pnpm db:studio                  # open Prisma Studio

# Web app
pnpm --filter @mindmap/web dev          # http://localhost:3100
pnpm --filter @mindmap/web build
pnpm --filter @mindmap/web typecheck
pnpm --filter @mindmap/web lint

# Tests
pnpm --filter @mindmap/web test         # vitest unit tests
pnpm --filter @mindmap/web test:watch   # vitest in watch mode
pnpm --filter @mindmap/web test:coverage # vitest with coverage
cd packages/brain && ./node_modules/.bin/tsx --test 'src/**/*.test.ts'  # brain unit tests
```

## Conventions

- **No `any`.** Use `unknown` + narrowing. ESLint bans `any`.
- **No `eslint-disable`** without a comment explaining why.
- **No comments** unless they explain _why_, not _what_.
- **No provider key on the client.** All AI calls go through `packages/brain`.
- **No `export *`.** Named exports only.
- **No barrel files** at the package level. Sub-path exports via `package.json` `exports`.
- **No emoji in product copy.** Emojis are user-set in workspaces, never UI chrome.
- **Sentences in UI end with periods; button labels do not.**
- **Sentence case in UI** (not Title Case).
- **Logical CSS properties** (`ms-`, `ps-`, `me-`, `pe-`) for RTL readiness.

## Dependency rules (enforced by ESLint)

```
apps/web           ──► any package
packages/brain     ──► { types, shared, prompts, analytics }
packages/parser    ──► { types, shared }
packages/database  ──► { types }
packages/auth      ──► { types, database }
packages/ui        ──► { types, shared }   (NEVER brain/database/auth)
packages/types     ──► { }                 (leaf)
packages/shared    ──► { }                 (leaf)
packages/prompts   ──► { types }            (leaf)
packages/analytics ──► { types }
packages/config    ──► { }                 (leaf)
```

## Ports

- Web dev server: **3100** (avoiding 3000 which is occupied on this machine).
- Prisma Studio: 5555 (default).

## Environment

- Node ≥ 20.18
- pnpm ≥ 10 (we pin 11.13.1 via `packageManager`)
- Postgres 16+ (Neon recommended) with `vector` and `pg_trgm` extensions (vector
  unused in MVP; declared in schema for future RAG).

## Brain rule (the most important)

> **No file outside `packages/brain` may import an AI SDK or call any LLM endpoint.**

This includes `openai`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`, `anthropic-sdk`,
or any `fetch` directly to `OPENCODE_*_BASE_URL`. Violations fail `pnpm lint`.

## Phase 7 — Polish, Accessibility, SEO, Testing, Docs

Phase 7 adds production-grade quality:

### What's new

- **Testing:** Vitest for unit/integration tests in `apps/web`. Brain tests use Node's native test runner.
- **Accessibility:** `prefers-reduced-motion` support, ARIA roles/labels, keyboard navigation, focus management, `aria-live` regions.
- **SEO:** `sitemap.ts`, `robots.ts`, OG image generation at `/api/og`, canonical URLs, hreflang.
- **Security:** CSP headers, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **GDPR:** Data export endpoint at `GET /api/export`.
- **ADRs:** Architecture Decision Records in `docs/adr/`.

### Test commands

```bash
# Unit/integration tests (Vitest)
pnpm --filter @mindmap/web test

# Brain unit tests (Node native test runner)
cd packages/brain && ./node_modules/.bin/tsx --test 'src/**/*.test.ts'

# E2E tests (manual scripts)
cd packages/database && ./node_modules/.bin/tsx test-e2e.mts
cd packages/database && ./node_modules/.bin/tsx diag-e2e.mts
```

## When in doubt

- Read `docs/architecture.md` first.
- Then the relevant package's `README.md` (added in phase 7).
- Ask the user; this is a hackathon-grade product designed to ship as a real SaaS.
