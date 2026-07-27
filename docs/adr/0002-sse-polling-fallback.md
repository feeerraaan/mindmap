# ADR-0002: SSE with polling fallback for real-time diagnosis

**Status:** Accepted  
**Date:** 2026-07-24

## Context

The diagnosis flow requires real-time streaming of LLM-generated questions to the client. The server runs on Next.js 16 (Node runtime for streaming routes), and the client is a React SPA with React Query for data fetching.

## Decision

Use Server-Sent Events (SSE) as the primary transport for the diagnosis stream, with a polling fallback after two consecutive connection failures.

- **Primary:** SSE via `fetch()` with `ReadableStream` parsing on the client.
- **Fallback:** React Query polling at 2-second intervals against `GET /api/diagnosis/[id]`.
- The SSE stream is opened once per session; on transient drops, we retry once with a 600ms backoff.
- After the second failure, we switch to polling and never retry SSE for that session.

## Rationale

- SSE works over HTTP/2, which Vercel supports natively. No separate WebSocket server needed.
- The `EventSource` API is unidirectional (server→client), which matches our needs — the client sends answers via `POST`.
- Polling fallback ensures resilience on flaky networks (conference wifi, mobile) without requiring a persistent connection.
- The 600ms backoff prevents thundering-herd on transient failures.

## Alternatives considered

- **WebSockets:** Rejected. Requires a separate server (Vercel doesn't support WebSockets in serverless), adds auth complexity, and we only need server→client streaming.
- **Server Actions with streaming:** Rejected. Next 16's `after()` is unreliable in dev/serverless contexts — the callback can be killed before it runs.
- **Inngest/QStash:** Overkill for MVP. The in-process `JobRunner` using Next's `after()` is sufficient; we keep the `JobRunner` interface ready for future swap.

## Consequences

- The SSE endpoint must set `Cache-Control: no-cache` and `Content-Type: text/event-stream`.
- The client must handle `EventSource`-like reconnection logic manually (we use `fetch()` + `ReadableStream` instead of the native `EventSource` API to get POST support and header control).
- Polling fallback doubles as a safety net for environments that block SSE (corporate proxies).
