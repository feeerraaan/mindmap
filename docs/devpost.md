## Inspiration

Most study tools optimize for *producing* — more flashcards, more summaries, more quizzes. But the real bottleneck in self-study isn't production volume; it's the **illusion of competence** — the gap between what you *recognize* and what you *truly understand*. We wanted to build the opposite: a tool that optimizes for *understanding*, that manufactures the uncomfortable moment where you realize you didn't actually know what you thought you knew. An MRI scan for knowledge, not another summarizer.

## What it does

MindMap builds a **Knowledge Graph** from any PDF, DOCX, or PPTX you upload, then runs an **adaptive diagnosis** — a calm Socratic interview that asks the *minimum* number of questions that *maximally* reveal your knowledge state, using Item Response Theory and Bayesian estimation.

The diagnosis runs as a 4-phase cycle: **DIAGNOSE → LEARN → PRACTICE → VERIFY**. It generates questions just-in-time via LLM, evaluates open-ended answers semantically, surfaces weak concepts through the dependency graph, and teaches you what you missed. At the end, a pure-math **Timeline Engine** schedules spaced reviews adapted to your measured `(mastery, confidence)` — no fixed forgetting curve, no manual card authoring.

The output is a visual Knowledge Map that fills with color as your mastery emerges: the product's hero moment.

## How we built it

- **12-package pnpm monorepo** with enforced import boundaries (ESLint `no-restricted-paths`). The `packages/brain` package is the **only** place that calls an LLM — every other package sees a typed `Brain` object.
- **Next.js 16 App Router** with Server Components, Server Actions, and SSE streaming for the diagnosis conversation (with a polling fallback for spotty connections).
- **Prisma + Neon Postgres** for persistence; a VPS worker with atomic `QUEUED → RUNNING` claims handles long-running PDF parsing and graph generation outside Vercel's serverless limits.
- **AI layer** on `@ai-sdk/openai-compatible` with a provider-independent router, task-based model selection (cheap for extraction, reasoning for evaluation), token-bucket cost guards, and versioned `.md` prompt templates with schema-repair retries.
- All LLM outputs are **Zod-validated**; on failure we retry with repair prompts (max 2), then mark the concept `failed` and continue — partial graphs over total failure.

## Challenges we ran into

**Keeping the AI boundary airtight.** The rule "only `packages/brain` imports an AI SDK" is enforced in flat ESLint config. As features shipped fast during the hackathon, the rule caught violations that would have leaked API keys to the client — exactly what it was designed to prevent.

**Schema-repair without token blowup.** LLMs return prose-wrapped or invalid JSON, especially from cheaper models. Our `extractJson` helper strips fences, Zod validates, and a repair prompt re-asks with the validation error — capped at 2 retries.

**Acyclic graphs from an LLM.** Extracted dependency edges sometimes contain cycles. A Tarjan SCC pass rejects them and drops offending edges rather than failing the whole graph build.

**IRT math that rewards honesty.** "I don't know" and "Skip" produce the same `correctness = 0` but *different* confidence updates. "I don't know" raises confidence (honest signal) while "Skip" lowers it. Getting the Bayesian posteriors right required hand-computed unit tests to verify the density didn't silently inflate mastery.

**SSE that survives demo WiFi.** The diagnosis uses SSE with a one-shot reconnect and a React Query polling fallback, so a dropped connection resumes from the persisted `DiagnosisSession` state.

**Multi-phase session lifecycle.** The 4-phase cycle (DIAGNOSE → LEARN → PRACTICE → VERIFY) shares one `DiagnosisSession` row. We learned the hard way that marking the session `COMPLETED` at the first `shouldStop` (end of DIAGNOSE) silently killed the LEARN, PRACTICE, and VERIFY phases — a one-line fix with outsized impact on timeline and history population.

## What we learned

- **Bayesian mastery estimation on a 2D grid.** Our IRT engine uses a 1PL logistic model with Fisher information for question selection and a discretized 2D `(mastery, confidence)` posterior, updated via grid-based Bayesian inference:

  $$P(\theta \mid r) \propto P(r \mid \theta) \cdot P(\theta)$$

  where the likelihood $P(r \mid \theta, b)$ is the standard 1PL IRT form:

  $$P(r = 1 \mid \theta, b) = \frac{1}{1 + e^{-(\theta - b)}}$$

- **Pure-math scheduling outperforms fixed curves.** Scheduling review intervals from measured `(mastery, confidence)` pairs — where intervals soften on failure instead of punitively doubling — produced review plans that felt more natural than any fixed-curve approach.

- **Streaming isn't optional for Socratic dialogue.** A streamed follow-up clarification when an answer is ambiguous turns a dead-end into a conversation. That's only possible with SSE and a language model behind it.

## What's next for MindMap

- **Performance:** reduce worker latency and cold starts so the platform feels faster end-to-end.
- **OCR** for scanned/image-only PDFs (currently surfaced gracefully).
- **Multi-document workspaces** — merge a learner's whole corpus into one unified knowledge graph.
- **Collaborative maps** — share a diagnostic snapshot, let a mentor review a student's gaps.
- **API for educators** — "diagnose my cohort on *this* material."
- **React Native app** (PWA-first until retention is proven).
