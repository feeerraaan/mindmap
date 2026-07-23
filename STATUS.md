# MindMap — Project Status

> **Read this first** to pick up where the previous session left off. The full
> architecture, product spec, and phase plans are in `docs/`. This file is the
> **delta** — what's been built, what's running, what's next.

---

## Current Phase

**Phase 3 — Document Upload, Storage, Parser** ✅ complete. E2E test PASS.

Next up: **Phase 4 — Brain: Router, Providers, Knowledge Graph.**

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

| Service | Port | How |
|---------|------|-----|
| Postgres + pgvector | 5432 | `docker ps` — container `mindmap-pg` (`ankane/pgvector`) |
| Dev server (Next 16 + Turbopack) | 3100 | `pnpm --filter @mindmap/web dev` |
| Local blob storage | `/var/mindmap/blobs/` | filesystem |
| Magic-link tokens (dev) | `$TMPDIR/mindmap-magic-links/` | files written by the dev `sendMagicLink` override |

**Dev server public URL**: `http://212.227.246.72:3100` (VPS IP `212.227.246.72`).
The Next config sets `allowedDevOrigins` so the dev server accepts that host.

**Memory constraint.** This VPS has 3.8 GB RAM. Always run dev/build/install
with `NODE_OPTIONS="--max-old-space-size=1024"`. If Satisfactory is running,
kill it (`kill -9 <pid>`) before long builds.

---

## What Phase 3 Delivered

| Feature | Files | Status |
|---------|-------|--------|
| Postgres + pgvector in Docker | `docker run ankane/pgvector` | ✅ |
| Prisma schema regenerated for Better Auth compatibility (`User.emailVerified: Boolean`, `Account.idToken`, `Verification` table) | `packages/database/prisma/schema.prisma` | ✅ |
| Parsers: PDF (`pdftotext` shell-out), DOCX (`mammoth`), PPTX (`jszip`) | `packages/parser/src/adapters/*.ts` | ✅ |
| Storage: `LocalFsStorage` (dev) + `VercelBlobStorage` (stub) | `apps/web/src/lib/storage.ts` | ✅ |
| In-process JobRunner using Next 16's `after()` | `apps/web/src/lib/jobs.ts` | ✅ |
| Routes: `POST /api/uploads/init`, `PUT /api/uploads/[id]`, `POST /api/uploads/finalize`, `GET /api/jobs/[id]`, `GET /api/documents/[id]/status` | `apps/web/src/app/api/...` | ✅ |
| UI: dropzone with `react-dropzone`, MIME allow-list, 25 MB cap | `apps/web/src/components/documents/upload-dropzone.tsx` | ✅ |
| UI: workspace doc list with `StatusBadge` + progress + React Query polling | `apps/web/src/components/documents/document-list.tsx` | ✅ |
| UI: workspace upload page | `apps/web/src/app/[locale]/(app)/mind/[workspaceId]/upload/page.tsx` | ✅ |
| Better Auth magic-link login (dev backdoor at `/api/dev/sign-in`) | `apps/web/src/app/api/dev/sign-in/route.ts` | ✅ |
| **E2E test: upload PDF → parse → chunks persisted** | `packages/database/test-e2e.mts` | ✅ |

---

## What's Next — Phase 4

**Goal:** Build the Brain's Knowledge Engine — extract chapters, topics, and
concepts from parsed document text, and persist them as a `KnowledgeGraph` in
the DB.

**Deliverables (from `docs/roadmap.md` §4):**
- `packages/brain/src/router/{router,policy,token-bucket}.ts` — task taxonomy,
  cheap/powerful provider selection, daily budget per user.
- `packages/brain/src/providers/{provider,zen,go,registry}.ts` — Vercel AI SDK
  OpenAI-compatible adapters (matches the @ai-sdk/openai-compatible adapter
  we already use elsewhere in the project).
- `packages/brain/src/engines/knowledge-engine.ts` — pipeline:
  classify language → extract structure → metadata → summarize concepts → relationships → validate (DAG, no cycles) → persist.
- `packages/prompts/prompts/{classify.language,extract.structure,extract.metadata,extract.relationships,summarize.concept}.md` — versioned prompt files with frontmatter.
- Wire `Job.type = 'BUILD_GRAPH'` into the `JobRunner`.
- Hook the new job into the `Job` pipeline so a `READY` document automatically
  transitions to `GRAPHING` → `READY` (with `Concept` rows).
- Add the `router` and `policy` config to `.env` (the OpenCode Zen/Go URLs
  are already in `.env.example`).

**Acceptance:** Upload a real 30-page PDF; ≥20 `Concept` rows persist with
non-empty `title` + `summary`; the dependency graph is acyclic (validator
rejects cycles silently).

**Note on providers.** Both OpenCode Zen and OpenCode Go are OpenAI-compatible
endpoints. We use `@ai-sdk/openai-compatible` to talk to them. The user
already has these env vars configured (see `.env`).

---

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

# Cleanup
fuser -k 3100/tcp
rm -rf /root/mindmap/apps/web/.next
```
