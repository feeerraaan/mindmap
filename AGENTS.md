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
```

## Conventions

- **No `any`.** Use `unknown` + narrowing. ESLint bans `any`.
- **No `eslint-disable`** without a comment explaining why.
- **No comments** unless they explain *why*, not *what*.
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

## When in doubt

- Read `docs/architecture.md` first.
- Then the relevant package's `README.md` (added in phase 8).
- Ask the user; this is a hackathon-grade product designed to ship as a real SaaS.
