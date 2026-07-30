import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { describeError } from '@mindmap/brain'
import { submitAnswer, AnswerInputSchema } from '@/features/diagnosis/actions'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/diagnosis/[id]/answer - submit the user's answer to the
 * current pending question. Returns:
 *   - the micro-feedback (one calm sentence)
 *   - whether the session is finished
 *   - an optional clarification question if the engine flagged an
 *     ambiguous answer and we still have clarification headroom
 *   - the latest global confidence for the calm progress ring
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await req.json().catch(() => null)) as { turnId?: unknown; answer?: unknown } | null
  if (!body || typeof body.turnId !== 'string') {
    return NextResponse.json({ error: 'missing turnId' }, { status: 400 })
  }
  const answer = AnswerInputSchema.safeParse(body.answer)
  if (!answer.success) {
    return NextResponse.json(
      { error: 'invalid answer', issues: answer.error.format() },
      { status: 400 },
    )
  }
  const result = await submitAnswer({
    sessionId: id,
    userId: user.id,
    turnId: body.turnId,
    answer: answer.data,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.kind, message: describeError(result.error) },
      { status: 400 },
    )
  }
  return NextResponse.json(result.value)
}
