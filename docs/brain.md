# MindMap — Brain (AI Architecture)

> The single rule: **no code outside `packages/brain` may import an AI SDK or call an
> LLM.** Everything AI flows through the Brain's typed public API.

---

## 1. Package Map

```
packages/brain/
├── src/
│   ├── index.ts                  # public API (Brain.knowledge, .evaluation, ...)
│   ├── router/
│   │   ├── router.ts             # RouterStrategy: picks provider+model per task
│   │   ├── policy.ts             # cost/latency rules
│   │   └── token-bucket.ts       # rate-limit guard per provider
│   ├── providers/
│   │   ├── provider.ts           # ProviderAdapter interface
│   │   ├── zen.ts                # OpenCode ZEN (OpenAI-compatible)
│   │   ├── go.ts                 # OpenCode GO  (OpenAI-compatible)
│   │   └── registry.ts           # id → adapter
│   ├── tasks/
│   │   ├── task.ts               # TaskType enum + TaskSpec
│   │   ├── classify.ts           # cheap classification
│   │   ├── extract.ts            # structured extraction (Zod-validated)
  │   │   ├── reason.ts             # reasoning
│   │   └── embed.ts              # future
│   ├── engines/
│   │   ├── knowledge-engine.ts   # builds KnowledgeGraph from ParsedDocument
│   │   ├── evaluation-engine.ts  # IRT-driven next-question selection + scoring
│   │   ├── timeline-engine.ts    # schedules reviews from history
│   │   ├── conversation-engine.ts# Socratic clarification loop
│   │   └── memory.ts             # session + long-term memory window
│   ├── prompts/
│   │   └── loader.ts             # loads versioned prompts from packages/prompts
│   ├── schemas/                  # Zod schemas for every LLM output
│   ├── retry.ts                  # exponential backoff + schema-repair retries
│   └── errors.ts                 # BrainError union
└── package.json
```

### Public API (re-exported by `apps/web/lib/brain.ts`)

```ts
export const Brain = {
  knowledge: { buildGraph },
  evaluation: { startDiagnosis, nextQuestion, submitAnswer, finalize },
  timeline: { scheduleReviews, nextDue },
  conversation: { clarify },
  memory: { remember, recall },
}
```

---

## 2. Providers

Both are **OpenAI-compatible** endpoints reached via `@ai-sdk/openai-compatible`.

| Provider ID | Base URL (env)          | Auth               | Default model          | Tier |
| ----------- | ----------------------- | ------------------ | ---------------------- | ---- |
| `zen`       | `OPENCODE_ZEN_BASE_URL` | `OPENCODE_ZEN_KEY` | `deepseek-v4-flash`    | Free |
| `go`        | `OPENCODE_GO_BASE_URL`  | `OPENCODE_GO_KEY`  | `mimo-2.5-class` (tbd) | Pro  |

### `ProviderAdapter` interface

```ts
interface ProviderAdapter {
  id: 'zen' | 'go' | string
  chat(req: ChatRequest): Promise<ChatResponse>
  chatStream(req: ChatRequest): AsyncIterable<ChatChunk>
  // embed?(...) // future
}
```

The adapter wraps `@ai-sdk/openai-compatible`'s `createOpenAICompatible`. Adding a new
provider (Anthropic, OpenAI direct, OpenRouter) = new file implementing `ProviderAdapter`

- one row in `registry.ts`. No engine or prompt code changes.

### Provider independence — why it matters

- A cheaper DeepSeek-tier model appearing next month is a config swap, not a rewrite.
- A jurisdiction-specific provider (e.g. EU-hosted) can be added per-user via the
  router's policy without touching the engine code.
- The router is the _only_ place that knows provider names. Engines see `TaskResult`, not
  `OpenAIResponse`.

---

## 3. Router

### Task taxonomy

```ts
type TaskType =
  | 'classify.language' // detect doc language — cheap
  | 'classify.topic' // tag topic/chapter — cheap
  | 'extract.structure' // chapters → topics → concepts — cheap
  | 'extract.relationships' // DAG edges — cheap
  | 'extract.metadata' // importance/difficulty priors — cheap
  | 'reason.diagnose' // generate adaptive question — Pro
  | 'reason.evaluate' // grade an open answer — Pro
  | 'reason.clarify' // conversational clarification — Pro
  | 'summarize.concept' // concept summary — cheap
  | 'schedule.review' // compute next review date — local, no LLM
```

### Router policy (default)

| Task                | Provider       | Model             | Rationale                                                         |
| ------------------- | -------------- | ----------------- | ----------------------------------------------------------------- |
| `classify.*`        | go             | deepseek-v4-flash | pure categorization, no reasoning needed                          |
| `extract.*`         | go             | deepseek-v4-flash | structured output, schema-validated, retries handle errors        |
| `summarize.concept` | go             | deepseek-v4-flash | short-form summarization                                          |
| `reason.diagnose`   | go             | deepseek-v4-flash | fast adaptive probing; zen fallback if go is unavailable          |
| `reason.evaluate`   | go             | deepseek-v4-flash | correctness scoring                                               |
| `reason.clarify`    | go             | deepseek-v4-flash | short, low-stakes                                                 |
| `schedule.review`   | — (local math) | —                 | no LLM call; pure function in `timeline-engine`                   |

The policy is **data, not code** — a `policy.ts` map. Adjusting which model handles a
task is a one-line edit.

### Selection algorithm

```
router.pick(task, user):
  candidates = policy[task]                       // ordered list
  for c in candidates:
    if tokenBucket(c.provider).try():
      return c
  // all rate-limited → queue with backoff
  return BudgetExceeded
```

### Cost guard

Each call records `tokensIn`, `tokensOut`, `provider`, `model` into `ConversationTurn`
(or `AuditEvent` for non-conversation tasks). A daily per-user budget is enforced at the
router (default 500k tokens/day). Over-budget → "Mind is resting" UX, not an error.

---

## 4. Prompt Strategy

### Location & versioning

Prompts live in **`packages/prompts`** as plain `.md` files with YAML frontmatter:

```md
---
id: reason.diagnose
version: 3
task: reason.diagnose
inputs: [concept, priorState, history]
output: DiagnosisQuestion
providerHint: go
---

You are MindMap's diagnostic engine. You are interviewing a learner about the
concept "{{concept.title}}". Their current mastery is {{priorState.mastery}}.

Produce a single question that maximally increases information about their
true mastery. ...
```

- Loaded at boot by `packages/brain/prompts/loader.ts`.
- Rendered with `mustache` (simple, safe — no arbitrary code).
- **Versioned**: bumping `version` and keeping the old file lets us A/B prompts.
- **Provider hints are non-binding** — the router may override.

### Why prompts are not inlined in code

1. Non-engineers (PM, pedagogy consultants) can edit copy without touching TS.
2. A/B testing prompt versions is a file swap, not a deploy.
3. The same prompt template works across providers (provider-specific quirks isolated in
   the adapter, not the prompt).

### Prompt library (initial set)

| Prompt ID               | Used by                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `classify.language`     | parser: detect doc locale                                          |
| `extract.structure`     | knowledge-engine: chapters/topics/concepts                         |
| `extract.relationships` | knowledge-engine: DAG edges                                        |
| `extract.metadata`      | knowledge-engine: importance/difficulty priors                     |
| `summarize.concept`     | knowledge-engine: concept summaries                                |
| `reason.diagnose.easy`  | evaluation-engine: MCQ for low-difficulty concepts                 |
| `reason.diagnose.hard`  | evaluation-engine: open reasoning for high-difficulty              |
| `reason.evaluate`       | evaluation-engine: grade open answer, return `correctness ∈ [0,1]` |
| `reason.clarify`        | conversation-engine: Socratic clarification on ambiguous answers   |

---

## 5. Knowledge Engine

### Input

A `ParsedDocument` (from `packages/parser`): `{ chunks: Chunk[], metadata, language }`.

### Pipeline

```
1. classify.language(doc)              → doc.language
2. extract.structure(doc)              → { chapters: [{ title, topics: [{ title, summary }] }] }
3. extract.metadata(chapters)          → importance/difficulty priors per topic
4. For each topic:
     summarize.concept(topic)          → Concept[]
5. extract.relationships(concepts)     → ConceptDependency[]
6. Validate (Zod) + acyclic check + retry-on-schema-fail (max 2)
7. Persist: Concept + ConceptDependency + DocumentChunk
```

### Output schema

```ts
const KnowledgeGraph = z.object({
  concepts: z.array(Concept),
  edges: z.array(z.object({ from: z.string(), to: z.string(), weight: z.number() })),
})
```

### Robustness

- **Schema-repair retry**: if the LLM returns invalid JSON or fails the Zod schema, we
  re-prompt with the validation error and the invalid output, asking for a corrected
  version. Up to 2 retries, then the engine marks the concept as `failed` and continues
  (partial graphs are better than no graph).
- **Cycle rejection**: a Tarjan SCC pass rejects cycles in `edges`; offending edges are
  dropped with a warning log, not fatal.

---

## 6. Evaluation Engine — Adaptive Diagnosis

This is the heart of MindMap. It must feel calm, fast, and _honest_.

### Per-concept knowledge state

```ts
type ConceptState = {
  mastery: number // [0,1]  — estimate of true mastery
  confidence: number // [0,1]  — certainty about `mastery`
  attempts: number
  correct: number
  lastSeen: Date | null
}
```

### Item Response Theory (IRT 1PL — Rasch model)

For each generated question we estimate a difficulty `b ∈ [-3, +3]`. The probability a
user with mastery `θ` (mapped from `[0,1]` to `[-3,+3]`) answers correctly is:

```
P(correct | θ, b) = 1 / (1 + exp(-(θ - b)))
```

### Bayesian update

After an answer with observed `correctness c ∈ [0,1]`:

```
likelihood(c | θ) = P^c * (1-P)^(1-c)
prior            = Beta(α, β) mapped to θ   // α,β derived from (mastery, confidence)
posterior ∝ prior * likelihood
mastery ← posterior mean
confidence ← 1 / (1 + posterior_variance)  // higher variance → lower confidence
```

We implement this with a discretized grid (20 points) for speed — no external math lib.
Tests cover the update in `evaluation-engine.test.ts`.

### Next-question selection (Maximum Information)

For each not-yet-probed concept (or due for re-probing), compute the **Fisher
information** of a hypothetical question at difficulty `b = current θ estimate`:

```
I(θ, b) = P(θ,b) * (1 - P(θ,b))   // maximized at b = θ
```

Pick the concept with the **highest `priority = importance * (1 - confidence) * I`**.
This biases toward: important concepts, low-confidence ones, and questions that
discriminate at the user's current level.

### Stopping rule

```
stop when:
  global_confidence ≥ 0.7    // weighted by importance
  OR questionsAsked ≥ q_max  // default 30, admin-tunable via env
  OR 3 consecutive questions changed mastery by < 0.02
```

### Neighbor propagation

When concept `C`'s mastery moves by `Δ`, propagate to dependencies:

```
for D in dependencies(C):  // C depends on D → if C improved, D probably knew too
  D.mastery += 0.3 * Δ * edge.weight
  D.confidence -= 0.1                       // we inferred, not measured
```

Capped at `[0,1]`. This is intentionally simple — it's a prior, not a measurement.

### "I don't know" / "Skip"

Both produce `c = 0` but with **different confidence penalties**:

- "I don't know" → honest signal, `confidence += 0.1` (we learned something real)
- "Skip" → no signal, `confidence -= 0.05` (we're more uncertain, not less)

This rewards honesty — a key `vision.md` principle.

---

## 7. Conversation Engine

For ambiguous answers (correctness in `[0.3, 0.7]`), the engine may trigger a
**clarification turn** — a short Socratic prompt ("What did you mean by X?") that
resolves to a `correctness` update. Bounded to **1 clarification per question**, max 3
per session, to avoid fatigue.

Implemented as an `AsyncIterable<Token>` for SSE streaming.

---

## 8. Timeline Engine

### Why not SM-2 / Anki's curve?

SM-2 assumes a fixed forgetting rate per card. MindMap has a _measured_ mastery +
confidence per concept. We adapt.

### Schedule function

```
interval(concept) =
  baseInterval
    * (1 + mastery)              // known concepts space out
    * (0.5 + confidence)         // uncertain concepts come back sooner
    * (1 + abs(lastDelta))       // recent big change → revisit soon
    * difficultyPenalty          // hard concepts shrink intervals

baseInterval starts at 1 day; multiplies by 2.2 on each successful review,
halves on a failed review (no punitive doubling).
```

Outputs a `dueAt` per `ConceptState`. `scheduleReviews(userId, documentId)` builds a
`ReviewPlan` with `ReviewSession`s grouped by day, each with ≤10 items prioritized by
`importance * (1 - mastery)`.

### Adapts to history

Every review re-runs the evaluation engine in a constrained mode (only probed concepts,
no new concept discovery) and updates `ConceptState`. The next `interval` is computed
from the _new_ state — so a concept that's been forgotten gets shorter intervals, and
one that's solidified gets longer ones.

---

## 9. Memory

### Session memory

Last `N=8` conversation turns are passed in the prompt context for `reason.diagnose` and
`reason.clarify`. Older turns are summarized (via `summarize.concept`-style prompt) into
a single `sessionSummary` string to keep token cost bounded.

### Long-term memory

- Persisted in `ConversationTurn` (full transcript) and `ConceptState` (distilled).
- The Brain's `memory.recall(userId, conceptId)` returns the relevant prior state.
- We do **not** feed entire history into prompts — that's an unmaintainable cost curve.
  Only the relevant concept's state + recent turns.

---

## 10. Cost Optimization

| Lever                    | Implementation                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| Cheap-first routing      | 80%+ of calls go to Zen/DeepSeek-Flash                                        |
| Schema-validated outputs | Eliminates "regenerate because it didn't parse" loops                         |
| Prompt caching           | `@ai-sdk/openai-compatible` cache prefix for system prompts (where supported) |
| Token budget per user    | Router enforces daily caps; over-budget → calm UX                             |
| Neighbor propagation     | Reduces questions needed (one answer updates N concepts)                      |
| No history bloat         | Session memory windowed; long-term in DB, not in prompts                      |
| Local scheduling         | Timeline engine is pure math, zero LLM calls                                  |
| Streaming                | `reason.clarify` streams so we can stop early if user is satisfied            |

### Estimated per-diagnosis cost (30 questions)

- 30 × `reason.diagnose` (Go, ~800 tokens in / 200 out) ≈ 30k tokens
- 30 × `reason.evaluate` (Go, ~600 in / 150 out) ≈ 22.5k tokens
- Total ~52.5k tokens × DeepSeek-Flash pricing ≈ well under $0.03 per diagnosis.

---

## 11. Conversation Strategy (UX-level)

- The diagnosis is framed as a _conversation_, not a quiz. Copy uses "Let's check one
  thing about X" not "Question 3 of 12".
- No progress count is shown mid-diagnosis (only the calm progress ring). Counting
  questions makes users rush.
- After each answer, a 1-line micro-feedback: "Yes, that's solid" / "Hmm, not quite —
  let's come back to this" — never verbose.
- On completion, the Knowledge Map animates from grayscale to colored as mastery fills
  in. This is the _moment_ the product sells itself.

---

## 12. Observability

- Every `ConversationTurn` records `provider`, `model`, `tokensIn`, `tokensOut` — this
  is our cost ledger.
- `BrainError` is a discriminated union: `RateLimited | SchemaFailure | ProviderError |
BudgetExceeded`. Each maps to a specific calm UX state, never a stack trace.
- (Phase 7) Wrap router calls in a lightweight OpenTelemetry span for trace correlation
  with the user's `traceId`.

---

## 13. Testing Strategy

- **Unit**: router policy, IRT math, Bayesian update, scheduler math, cycle detection.
- **Schema**: every LLM output schema has a fixture-based test (valid + invalid samples).
- **Integration**: a mock `ProviderAdapter` returns canned responses; the full
  knowledge-engine pipeline runs against a fixture PDF and asserts a graph of expected
  shape.
- **Provider calls**: never run in CI by default. A separate `pnpm test:live` task
  requires `OPENCODE_*_KEY` and is run manually before releases.
