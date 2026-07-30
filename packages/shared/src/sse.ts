/**
 * SSE helpers - used by apps/web Route Handlers and the client EventSource wrapper.
 * Server side: `sseResponse(events)` returns a Response with the right headers.
 * Client side: `parseSSEStream(text)` parses `event:` / `data:` lines.
 */

export interface SseEvent {
  event?: string
  data: string
  id?: string
}

export function sseResponse(events: AsyncIterable<SseEvent>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const ev of events) {
          const lines: string[] = []
          if (ev.event) lines.push(`event: ${ev.event}`)
          lines.push(`data: ${ev.data}`)
          if (ev.id) lines.push(`id: ${ev.id}`)
          lines.push('')
          lines.push('')
          controller.enqueue(enc.encode(lines.join('\n')))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}

/**
 * Parse a single SSE frame from a chunk of text. Returns the event and the
 * remaining unparsed text. Intended for manual fetch streaming; for the
 * browser we use EventSource directly.
 */
export function parseSSEChunk(buffer: string): { event: SseEvent | null; rest: string } {
  const sep = buffer.indexOf('\n\n')
  if (sep === -1) return { event: null, rest: buffer }

  const frame = buffer.slice(0, sep)
  const rest = buffer.slice(sep + 2)

  const event: SseEvent = { data: '' }
  const lines = frame.split('\n')
  for (const line of lines) {
    if (line.startsWith('event:')) event.event = line.slice(6).trim()
    else if (line.startsWith('data:')) {
      const prev = event.data ? event.data + '\n' : ''
      event.data = prev + line.slice(5).trim()
    } else if (line.startsWith('id:')) event.id = line.slice(3).trim()
  }

  if (event.data === '' && !event.event && !event.id) return { event: null, rest }
  return { event, rest }
}
