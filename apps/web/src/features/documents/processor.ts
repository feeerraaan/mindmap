/**
 * Document processor — runs after an upload lands in storage.
 *
 * Pipeline:
 *   1. Read bytes from storage
 *   2. parseDocument() → DocumentChunk[]
 *   3. Persist chunks
 *   4. Update Document.status (PARSING → GRAPHING)
 *   5. Return ok=true so the runner can chain a BUILD_GRAPH job.
 *
 * On error, set status = FAILED and write a structured message to Job.error.
 */
import { parseDocument } from '@mindmap/parser'
import { prisma } from '@mindmap/database'
import { getStorage } from '@/lib/storage'

export interface ProcessInput {
  documentId: string
}

export interface ProcessResult {
  ok: boolean
  chunkCount: number
  pageCount: number | null
}

export async function processDocument(input: ProcessInput): Promise<ProcessResult> {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } })
  if (!doc) throw new Error(`Document ${input.documentId} not found`)

  await prisma.document.update({ where: { id: doc.id }, data: { status: 'PARSING' } })
  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'PARSE' },
    data: { status: 'RUNNING', startedAt: new Date(), progress: 0.2 },
  })

  const storage = getStorage()
  const bytes = await storage.get(doc.blobKey)

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
    throw new Error(result.error.message)
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

  // Hand the document off to the graphing stage. The runner will pick up
  // the BUILD_GRAPH job that this status change is paired with.
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
