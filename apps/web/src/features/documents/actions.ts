'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@mindmap/database'
import { requireUser } from '@mindmap/auth'
import { getStorage } from '@/lib/storage'
import { getRunner } from '@/lib/jobs'

const ACCEPTED_MIME = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
])

const MAX_BYTES = 25 * 1024 * 1024

const InitSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  workspaceId: z.string().min(1),
})

export interface InitUploadResult {
  documentId: string
  uploadUrl: string
  blobKey: string
  method: 'PUT' | 'POST'
  headers: Record<string, string>
}

/**
 * Step 1: create the Document row + a Job, return a signed URL for the
 * client to PUT the bytes directly. With the local FS adapter we return a
 * same-origin URL into our /api/uploads/[id] handler instead.
 */
export async function initUpload(input: z.input<typeof InitSchema>): Promise<InitUploadResult> {
  const user = await requireUser()
  const data = InitSchema.parse(input)
  if (!ACCEPTED_MIME.has(data.mimeType)) {
    throw new Error('Unsupported file type. PDF, DOCX, or PPTX only.')
  }
  if (data.sizeBytes > MAX_BYTES) {
    throw new Error('File is larger than 25 MB.')
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: data.workspaceId, ownerId: user.id },
    select: { id: true },
  })
  if (!workspace) throw new Error('Workspace not found')

  const storage = getStorage()
  const blobKey = storage.newKey(data.filename)

  const doc = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      blobKey,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      status: 'QUEUED',
    },
  })

  // The client PUTs to our own same-origin route. The route forwards the
  // bytes to whatever storage adapter is configured (LocalFsStorage in dev,
  // VercelBlobStorage in prod). This keeps the client identical across
  // environments and lets the server hold the storage token.
  return {
    documentId: doc.id,
    uploadUrl: `/api/uploads/${doc.id}`,
    blobKey,
    method: 'PUT',
    headers: { 'content-type': data.mimeType },
  }
}

/**
 * Step 2: client calls this after the PUT returns 200. The server reads
 * the file from storage, persists the row, and enqueues the parse job.
 */
export async function finalizeUpload(documentId: string) {
  const user = await requireUser()
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc) throw new Error('Document not found')
  if (doc.workspace.ownerId !== user.id) throw new Error('Not authorized')
  if (doc.status !== 'QUEUED') return { jobId: null, documentId: doc.id }

  const { jobId } = await getRunner().enqueue('PARSE', doc.id)
  const locale =
    ((await prisma.user.findUnique({ where: { id: user.id }, select: { locale: true } }))
      ?.locale as 'en' | 'es' | null) ?? 'en'
  revalidatePath(`/${locale}/mind/${doc.workspaceId}`)
  return { jobId, documentId: doc.id }
}

export async function deleteDocument(documentId: string) {
  const user = await requireUser()
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc) throw new Error('Document not found')
  if (doc.workspace.ownerId !== user.id) throw new Error('Not authorized')

  // Remove the underlying file/blob before deleting the row.
  const storage = getStorage()
  try {
    await storage.delete(doc.blobKey)
  } catch {
    // Storage deletion is best-effort; the row cleanup is what matters.
  }

  // Delete related rows
  await prisma.concept.deleteMany({ where: { documentId: doc.id } })
  await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } })
  await prisma.job.deleteMany({ where: { documentId: doc.id } })
  await prisma.document.delete({ where: { id: doc.id } })

  const locale =
    ((await prisma.user.findUnique({ where: { id: user.id }, select: { locale: true } }))
      ?.locale as 'en' | 'es' | null) ?? 'en'
  revalidatePath(`/${locale}/mind/${doc.workspaceId}`)
}
