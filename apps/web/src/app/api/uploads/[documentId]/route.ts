import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { getStorage } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The route streams up to ~4.5 MB (Vercel's request body cap) through to
// the storage backend. The default 10 s maxDuration is too tight for that
// plus a TLS handshake + fetch to the VPS, so we raise it.
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

/**
 * PUT /api/uploads/[documentId]
 * Receives the raw bytes for a previously initialized document. After the
 * bytes are persisted the route does NOT kick off parsing — the client
 * must call `finalizeUpload(documentId)` to enqueue the parse job. This
 * split lets us return 200 quickly and avoid the serverless timeout on
 * big uploads.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (doc.workspace.ownerId !== user.id)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (doc.status !== 'QUEUED')
    return NextResponse.json({ error: 'already uploaded' }, { status: 409 })

  const lengthHeader = req.headers.get('content-length')
  const declaredLength = lengthHeader ? Number(lengthHeader) : doc.sizeBytes
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json({ error: 'too large' }, { status: 413 })
  }

  const ab = await req.arrayBuffer()
  const bytes = new Uint8Array(ab)
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'too large' }, { status: 413 })
  }

  const storage = getStorage()
  try {
    await storage.put({ bytes, mimeType: doc.mimeType, filename: doc.filename, key: doc.blobKey })
  } catch (err) {
    console.error(
      `[upload ${documentId}] storage.put failed (${bytes.byteLength} bytes, ${doc.mimeType}):`,
      err,
    )
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'storage put failed' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, documentId: doc.id, sizeBytes: bytes.byteLength })
}
