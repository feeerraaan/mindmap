import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@mindmap/auth'
import { startReviewSession } from '@/features/timeline/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({ id: z.string().min(1) })

/**
 * POST /api/timeline/[id]/start - flip a `ReviewSession` to STARTED and
 * return the items the client should walk through. Idempotent: a
 * session already in STARTED returns the items.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = ParamsSchema.safeParse({ id })
  if (!parsed.success) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const view = await startReviewSession(parsed.data.id, user.id)
  if (!view) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    sessionId: view.sessionId,
    documentId: view.documentId,
    documentName: view.documentName,
    status: view.status,
    startedAt: view.startedAt.toISOString(),
    items: view.items,
  })
}
