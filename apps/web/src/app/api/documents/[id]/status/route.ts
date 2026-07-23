import { NextResponse } from 'next/server'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/documents/[id]/status — used by the workspace list poller.
 * Returns the document's current status + an inferred progress in [0,1].
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc || doc.workspace.ownerId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const progress = inferProgress(doc.status)
  return NextResponse.json({ status: doc.status, progress })
}

function inferProgress(status: string): number {
  switch (status) {
    case 'QUEUED':
      return 0.1
    case 'PARSING':
      return 0.5
    case 'GRAPHING':
      return 0.7
    case 'DIAGNOSING':
      return 0.9
    case 'READY':
    case 'MAPPED':
      return 1
    default:
      return 0
  }
}
