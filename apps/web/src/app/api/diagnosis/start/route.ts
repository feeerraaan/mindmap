import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@mindmap/auth'
import { describeError } from '@mindmap/brain'
import { startDiagnosis } from '@/features/diagnosis/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  documentId: z.string().min(1),
})

/**
 * POST /api/diagnosis/start - start (or resume) a diagnosis session for
 * a document. The response carries the first question (or, if the engine
 * decides there's nothing left to probe, marks the session finished).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as unknown
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const result = await startDiagnosis({ documentId: parsed.data.documentId, userId: user.id })
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.kind, message: describeError(result.error) },
      { status: 400 },
    )
  }
  return NextResponse.json({
    sessionId: result.value.sessionId,
    firstQuestion: result.value.firstQuestion,
    finished: result.value.finished,
    globalConfidence: result.value.globalConfidence,
  })
}
