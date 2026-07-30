import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'
import { describeError } from '@mindmap/brain'
import { getNextQuestion } from '@/features/diagnosis/actions'
import { sseResponse, type SseEvent } from '@mindmap/shared'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * GET /api/diagnosis/[id]/next - SSE endpoint that streams a single
 * "next question" event for an active session. After the first event
 * the stream closes; the client reconnects to fetch the next question
 * after submitting the previous answer.
 *
 * Why SSE and not a single JSON response? Two reasons:
 *   1. The LLM round-trip for `reason.diagnose` is the longest single
 *      hop in the diagnosis flow; streaming lets us show "Mind is
 *      thinking…" state in the UI.
 *   2. The same endpoint will be reused in Phase 6 to stream the
 *      review-diagnosis flow without a route change.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return sseResponse(errorStream({ kind: 'unauthorized', message: 'Sign in to continue.' }))
  }
  const { id } = await params
  // Authorise: the user must own this session.
  const session = await prisma.diagnosisSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) {
    return sseResponse(errorStream({ kind: 'notfound', message: 'Session not found.' }))
  }
  if (session.status !== 'ACTIVE') {
    return sseResponse(finishedStream(session.globalConfidence))
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const result = await getNextQuestion({ sessionId: id, userId: user.id })
    if (!result.ok) {
      return sseResponse(
        errorStream({ kind: result.error.kind, message: describeError(result.error) }),
      )
    }
    if (result.value.finished) {
      return sseResponse(finishedStream(result.value.globalConfidence))
    }
    return sseResponse(
      nextStream(result.value.turnId, result.value.question, result.value.globalConfidence),
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Timed out generating next question.'
    return sseResponse(errorStream({ kind: 'timeout', message: msg }))
  } finally {
    clearTimeout(timeout)
  }
}

async function* errorStream(err: { kind: string; message: string }): AsyncIterable<SseEvent> {
  yield { event: 'error', data: JSON.stringify(err) }
}

async function* finishedStream(globalConfidence: number): AsyncIterable<SseEvent> {
  yield { event: 'state', data: JSON.stringify({ globalConfidence, finished: true }) }
  yield { event: 'complete', data: JSON.stringify({ ok: true }) }
}

async function* nextStream(
  turnId: string,
  question: unknown,
  globalConfidence: number,
): AsyncIterable<SseEvent> {
  // Brief "thinking" frame so the UI can show the calm state.
  yield { event: 'state', data: JSON.stringify({ phase: 'thinking', globalConfidence }) }
  yield { event: 'question', data: JSON.stringify({ turnId, question, globalConfidence }) }
  yield { event: 'complete', data: JSON.stringify({ ok: true }) }
}
