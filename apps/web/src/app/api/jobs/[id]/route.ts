import { NextResponse } from 'next/server'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/jobs/[id] - status snapshot for the client poller.
 * Returns the most recent job for the document the user owns.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (job.documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: job.documentId },
      include: { workspace: { select: { ownerId: true } } },
    })
    if (!doc || doc.workspace.ownerId !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    error: job.error,
    finishedAt: job.finishedAt,
  })
}
