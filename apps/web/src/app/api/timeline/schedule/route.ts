import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { scheduleReviewsForDocument } from '@/features/timeline/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/timeline/schedule — rebuild the ReviewPlan for a document.
 * The diagnosis finaliser calls this; clients may also call it after
 * the document's been edited or after a long absence.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { documentId?: unknown } | null
  if (!body || typeof body.documentId !== 'string') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  await scheduleReviewsForDocument(body.documentId, user.id)
  return NextResponse.json({ ok: true })
}
