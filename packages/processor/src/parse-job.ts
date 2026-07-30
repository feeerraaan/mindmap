/**
 * PARSE job - run by the VPS worker after an upload lands in storage.
 *
 * Pipeline:
 *   1. Mark Document as PARSING and the PARSE job as RUNNING.
 *   2. Fetch the original bytes via the injected `readBytes` (the worker
 *      reads directly from /var/mindmap/blobs).
 *   3. parseDocument() → DocumentChunk[]
 *   4. Replace any prior chunks for this document and persist the new ones.
 *   5. Move the document to GRAPHING so the worker can enqueue BUILD_GRAPH.
 *
 * On error, Document → FAILED and the job row records the message. The
 * caller (worker) marks the job COMPLETED/FAILED itself; this function
 * throws on fatal errors and returns a structured result otherwise so the
 * worker can decide whether to chain a BUILD_GRAPH job.
 */
import { parseDocument } from '@mindmap/parser'
import { prisma } from '@mindmap/database'

export interface ParseJobInput {
  documentId: string
  readBytes: (blobKey: string) => Promise<Uint8Array>
}

export interface ParseJobResult {
  ok: boolean
  chunkCount: number
  pageCount: number | null
  error?: string
}

export async function processParseJob(input: ParseJobInput): Promise<ParseJobResult> {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } })
  if (!doc) throw new Error(`Document ${input.documentId} not found`)

  await prisma.document.update({ where: { id: doc.id }, data: { status: 'PARSING' } })
  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'PARSE' },
    data: { status: 'RUNNING', startedAt: new Date(), progress: 0.2 },
  })

  const bytes = await input.readBytes(doc.blobKey)

  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'PARSE' },
    data: { progress: 0.5 },
  })

  const result = await parseDocument({ bytes, mimeType: doc.mimeType, filename: doc.filename })
  if (!result.ok) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED' } })
    await prisma.job.updateMany({
      where: { documentId: doc.id, type: 'PARSE' },
      data: { status: 'FAILED', finishedAt: new Date(), error: result.error.message },
    })
    return { ok: false, chunkCount: 0, pageCount: null, error: result.error.message }
  }

  const parsed = result.value
  await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } })
  await prisma.documentChunk.createMany({
    data: parsed.chunks.map((c) => ({
      documentId: doc.id,
      index: c.index,
      text: c.text,
      page: c.page,
      chapter: c.chapter,
    })),
  })

  // Hand the document off to the graphing stage. The worker enqueues a
  // BUILD_GRAPH job once this function returns ok.
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: 'GRAPHING',
      pageCount: parsed.pageCount ?? doc.pageCount,
      language: parsed.language ?? doc.language,
    },
  })
  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'PARSE' },
    data: { status: 'COMPLETED', finishedAt: new Date(), progress: 1.0 },
  })

  return { ok: true, chunkCount: parsed.chunks.length, pageCount: parsed.pageCount ?? null }
}
