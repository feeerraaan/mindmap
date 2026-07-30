import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { loadSessionSnapshot } from '@/features/diagnosis/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/diagnosis/[id] - polling fallback. Returns the session
 * snapshot including any pending question, the global confidence, the
 * question cap, and a `finished` flag.
 *
 * The client `EventSource` connection uses this route's content as the
 * recovery snapshot after a reconnect.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const snap = await loadSessionSnapshot(id, user.id)
  if (!snap) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(snap)
}
