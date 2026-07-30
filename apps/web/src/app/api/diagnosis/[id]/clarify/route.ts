import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { describeError } from '@mindmap/brain'
import { applyClarification } from '@/features/diagnosis/actions'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/diagnosis/[id]/clarify - apply the user's follow-up text
 * to a pending Socratic clarification, re-score the original question,
 * and return the new micro-feedback.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null
  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return NextResponse.json({ error: 'missing text' }, { status: 400 })
  }
  const result = await applyClarification({
    sessionId: id,
    userId: user.id,
    followUp: body.text,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.kind, message: describeError(result.error) },
      { status: 400 },
    )
  }
  return NextResponse.json(result.value)
}
