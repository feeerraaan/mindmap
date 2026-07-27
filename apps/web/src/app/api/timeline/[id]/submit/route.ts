import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@mindmap/auth'
import { submitReviewAnswers } from '@/features/timeline/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  answers: z.array(
    z.object({
      itemId: z.string().min(1),
      conceptId: z.string().min(1),
      result: z.enum(['knew', 'didnt', 'skip']),
    }),
  ),
})

const ParamsSchema = z.object({ id: z.string().min(1) })

/**
 * POST /api/timeline/[id]/submit — record a batch of review answers,
 * update the per-concept mastery/confidence, and reschedule the
 * document's ReviewPlan. Returns a brief summary.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const parsedId = ParamsSchema.safeParse({ id })
  if (!parsedId.success) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const body = (await req.json().catch(() => null)) as unknown
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const out = await submitReviewAnswers(parsedId.data.id, user.id, parsed.data.answers)
  if (!out) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    sessionId: out.sessionId,
    completedAt: out.completedAt.toISOString(),
    items: out.items,
    nextScheduledFor: out.nextScheduledFor ? out.nextScheduledFor.toISOString() : null,
    averageDelta: out.averageDelta,
  })
}
