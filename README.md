# MindMap

> An MRI scan for knowledge. Not an assistant. Not a summarizer. A diagnostic.

MindMap diagnoses what you truly know vs. what you think you know. You upload a document
(PDF / PPTX / DOCX), MindMap builds a knowledge graph, runs an adaptive diagnosis, and
gives you a calm, visual knowledge map plus a personalized review timeline.

See [`docs/vision.md`](docs/vision.md) for the product vision and
[`docs/architecture.md`](docs/architecture.md) for the technical architecture.

## Status

Phase 1 — Foundation. Monorepo, auth, database, design system, PWA, landing page.

## Stack

- Next.js 16 (App Router, RSC)
- React 19
- TypeScript (strict, `noUncheckedIndexedAccess`)
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- Prisma ORM + Neon Postgres
- Better Auth (Google OAuth + magic-link email)
- next-intl (EN default, ES secondary)
- React Query
- Zod
- pnpm workspaces + Turborepo
- Vercel (deploy) + Vercel Blob (storage)

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in keys
pnpm db:push           # apply Prisma schema
pnpm db:seed           # seed demo user + sample graph
pnpm dev               # http://localhost:3100
```

## Layout

```
apps/web              — Next.js 16 app (the only deployable)
packages/
  brain               — AI: router, engines, prompts, memory
  ui                  — shadcn/ui-based design system
  database            — Prisma schema, client, migrations, seeds
  auth                — Better Auth config + helpers
  config              — eslint, tsconfig, tailwind preset
  types               — Cross-package domain types (Zod)
  shared              — Pure utils: id, dates, sse, retry
  parser              — Document parsing adapters
  analytics           — Event tracking abstraction
  prompts             — Versioned prompt templates
docs/                 — Vision, PRD, architecture, database, brain, ui, roadmap
```

## Architecture rules

- `packages/ui` is the only package UI components live in (and they're prop-in /
  event-out, never data-fetching).
- `packages/brain` is the only package that may import an AI SDK or call an LLM.
  Violations fail CI.
- Strict import boundaries enforced via ESLint
  (`import/no-restricted-paths` + `import/no-cycle`).

See [`docs/architecture.md`](docs/architecture.md) §2 for the full dependency graph.

## License

Proprietary — all rights reserved.
