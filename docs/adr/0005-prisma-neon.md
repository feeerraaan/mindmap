# ADR-0005: Prisma ORM with Neon Postgres

**Status:** Accepted  
**Date:** 2026-07-24

## Context

MindMap needs a relational database for users, workspaces, documents, concepts, diagnosis sessions, and review plans. The database must support:

- Serverless deployment (Vercel)
- Branching for preview deploys
- Full-text search (future)
- Vector embeddings (future RAG)
- ACID transactions for document processing and review scheduling

## Decision

Use Prisma ORM with Neon Postgres as the database.

- **ORM:** Prisma 6.x with the Postgres provider.
- **Database:** Neon Postgres (serverless, branchable).
- **Connection:** `@prisma/client` with the Neon serverless driver for edge compatibility, standard TCP for Node runtime.
- **Migrations:** `prisma db push` for preview deploys (no migration history), `prisma migrate deploy` for production.
- **Extensions:** `pg_trgm` for trigram search (declared in schema, unused in MVP), `vector` for pgvector (declared, unused in MVP).

## Rationale

- Prisma provides type-safe database access with auto-generated TypeScript types from the schema.
- Neon's branching model maps perfectly to Vercel's preview deploy model — each PR gets its own database branch.
- Postgres supports JSONB for feature flags, `pg_trgm` for search, and `pgvector` for future RAG — all in one database.
- Prisma's `db push` is ideal for preview deploys — it syncs the schema without creating migration files.
- The `@prisma/client` package handles connection pooling, query optimization, and type generation automatically.

## Alternatives considered

- **Drizzle ORM:** Rejected. Less mature ecosystem, fewer generated types, no visual schema editor (Prisma Studio).
- **TypeORM:** Rejected. Less type-safe, more boilerplate, weaker migration system.
- **Supabase (PostgREST):** Rejected. Couples us to their auth/storage/realtime stack; we chose best-of-breed (Better Auth, Vercel Blob, Neon).
- **Turso/SQLite:** Rejected. Lacks `pgvector` and Prisma's full feature set. Neon's branching is a better fit for preview deploys.
- **MongoDB:** Rejected. Relational data (user → workspace → document → concept → dependency) demands a relational database.

## Consequences

- The Prisma schema is the single source of truth for the database structure.
- `pnpm db:generate` must run after any schema change to regenerate the Prisma client.
- The dev server must be restarted after schema changes (Turbopack caches the Prisma client).
- Preview deploys use `prisma db push` (no migration history pollution); production uses `prisma migrate deploy`.
- All database writes are validated by Zod schemas at the application boundary — Prisma is not the validation layer.
