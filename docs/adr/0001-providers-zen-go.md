# ADR 0001 — Provider choice: OpenCode ZEN & GO

## Status

Accepted (2026-07-23).

## Context

MindMap needs:

- A **cheap, fast** model for classification, extraction, metadata, parsing — the
  bulk of the AI spend.
- A **powerful reasoning** model for the adaptive diagnosis, evaluation, and
  clarification — where quality matters more than cost.

We are building for a hackathon, then a real SaaS. Provider lock-in is a real risk:
cheap models improve every quarter, and we want to be able to switch without a rewrite.

## Decision

- **Primary:** OpenCode GO with the `deepseek-v4-flash` model for all tasks.
- **Fallback:** OpenCode ZEN with the `ling-3.0-flash-free` model if GO is unavailable.
- All provider access goes through the `ProviderAdapter` interface in
  `packages/brain/providers/`. Engines never import a provider SDK directly.
- Base URLs and keys live in env vars only. No provider name is hardcoded
  outside `registry.ts` and the policy table.

## Consequences

- A single provider SDK (`@ai-sdk/openai-compatible`) is the only AI dependency
  in `packages/brain`. Adding OpenAI direct or Anthropic is a new file in
  `providers/`.
- A/B testing model switches is a one-line policy edit.
- If a provider is unreachable, the router falls through to the next candidate
  instead of returning an error, and logs the event.

## Alternatives considered

- **OpenRouter as the meta-provider.** Tempting — one endpoint, one bill, easy
  fallback. Rejected for now because routing through OpenRouter hides the
  underlying providers (we want explicit control over which model answers
  which task for cost / latency tuning). OpenRouter is a one-day migration if
  we change our mind.
- **Direct OpenAI + DeepSeek + Anthropic SDKs.** Most control, worst portability.
  Every switch requires code changes.
- **Self-hosted models on a GPU box.** Tempting for cost, hostile for hackathon
  velocity. Deferred to Horizon 3.
