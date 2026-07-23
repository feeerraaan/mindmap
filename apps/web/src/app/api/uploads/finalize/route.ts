import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@mindmap/auth'
import { finalizeUpload } from '@/features/documents/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/uploads/finalize
 * JSON body: { documentId }
 * → 200 { jobId, documentId }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { documentId } = (await req.json()) as { documentId: string }
    const result = await finalizeUpload(documentId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 400 })
  }
}
