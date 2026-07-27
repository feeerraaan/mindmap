/**
 * Build-graph processor — runs after PARSE finishes.
 *
 * Pipeline:
 *   1. Read DocumentChunk rows for the document
 *   2. Build a ParsedDocument and call `Brain.knowledge.buildGraph`
 *   3. Persist Concept + ConceptDependency rows (idempotent re-runs)
 *   4. Document.status: GRAPHING → READY (or → FAILED on unrecoverable error)
 *
 * The processor is the only place that touches Prisma from the Brain
 * pipeline. The engine itself returns a KnowledgeGraph and never
 * reads/writes the DB, so the boundary from docs/architecture.md §2
 * stays clean: `apps/web` depends on `@mindmap/brain`, not the other
 * way around.
 */
import { Brain, type KnowledgeBuildOutput } from '@mindmap/brain'
import { prisma } from '@mindmap/database'
import type { ParsedDocument } from '@mindmap/types'

export interface BuildGraphInput {
  documentId: string
}

export interface BuildGraphResult {
  ok: boolean
  conceptCount: number
  edgeCount: number
  droppedEdges: number
  language: string
  tokensIn: number
  tokensOut: number
}

export async function processBuildGraph(input: BuildGraphInput): Promise<BuildGraphResult> {
  const doc = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { workspace: { select: { ownerId: true } } },
  })
  if (!doc) throw new Error(`Document ${input.documentId} not found`)

  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'BUILD_GRAPH' },
    data: { status: 'RUNNING', startedAt: new Date(), progress: 0.1 },
  })

  // Pull the parsed chunks back into a ParsedDocument.
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: doc.id },
    orderBy: { index: 'asc' },
    select: { index: true, text: true, page: true, chapter: true },
  })
  if (chunks.length === 0) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED' } })
    await prisma.job.updateMany({
      where: { documentId: doc.id, type: 'BUILD_GRAPH' },
      data: { status: 'FAILED', finishedAt: new Date(), error: 'No chunks to build a graph from.' },
    })
    return {
      ok: false,
      conceptCount: 0,
      edgeCount: 0,
      droppedEdges: 0,
      language: 'en',
      tokensIn: 0,
      tokensOut: 0,
    }
  }

  const parsed: ParsedDocument = {
    chunks: chunks.map((c) => ({
      index: c.index,
      text: c.text,
      page: c.page,
      chapter: c.chapter,
    })),
    pageCount: doc.pageCount,
    language: doc.language,
    metadata: {},
  }

  // Update progress as the engine emits stages.
  const onProgress = async (fraction: number) => {
    await prisma.job.updateMany({
      where: { documentId: doc.id, type: 'BUILD_GRAPH' },
      data: { progress: Math.max(0.1, Math.min(0.95, fraction)) },
    })
  }

  const result = await Brain.knowledge.buildGraph({
    document: parsed,
    userId: doc.workspace.ownerId,
    onProgress: (fraction) => {
      // Fire and forget — the engine awaits its own work; the job row
      // update is best-effort.
      void onProgress(fraction)
    },
  })

  if (!result.ok) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED' } })
    await prisma.job.updateMany({
      where: { documentId: doc.id, type: 'BUILD_GRAPH' },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: errorMessage(result.error),
      },
    })
    return {
      ok: false,
      conceptCount: 0,
      edgeCount: 0,
      droppedEdges: 0,
      language: doc.language ?? 'en',
      tokensIn: 0,
      tokensOut: 0,
    }
  }

  const out: KnowledgeBuildOutput = result.value

  // Persist concepts + edges idempotently.
  const persisted = await persistGraph(doc.id, out)
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'READY', language: out.language },
  })
  await prisma.job.updateMany({
    where: { documentId: doc.id, type: 'BUILD_GRAPH' },
    data: {
      status: 'COMPLETED',
      finishedAt: new Date(),
      progress: 1,
      result: {
        conceptCount: persisted.conceptCount,
        edgeCount: persisted.edgeCount,
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
        language: out.language,
      },
    },
  })

  return {
    ok: true,
    conceptCount: persisted.conceptCount,
    edgeCount: persisted.edgeCount,
    droppedEdges: out.droppedEdges,
    language: out.language,
    tokensIn: out.tokensIn,
    tokensOut: out.tokensOut,
  }
}

interface PersistReport {
  conceptCount: number
  edgeCount: number
}

async function persistGraph(documentId: string, out: KnowledgeBuildOutput): Promise<PersistReport> {
  // Concept + ConceptDependency rows are scoped per document. Wipe and
  // re-insert so re-runs are idempotent.
  await prisma.$transaction([
    prisma.conceptDependency.deleteMany({ where: { dependant: { documentId } } }),
    prisma.concept.deleteMany({ where: { documentId } }),
  ])

  if (out.graph.concepts.length === 0) {
    return { conceptCount: 0, edgeCount: 0 }
  }

  const created = await prisma.$transaction(
    out.graph.concepts.map((c) =>
      prisma.concept.create({
        data: {
          documentId,
          externalId: c.externalId,
          title: c.title,
          summary: c.summary,
          importance: c.importance,
          difficulty: c.difficulty,
          chapter: c.chapter,
          topic: c.topic,
        },
      }),
    ),
  )
  const byExternal = new Map(created.map((row) => [row.externalId, row]))

  const edgeRows = out.graph.edges
    .map((e) => {
      const from = byExternal.get(e.from)
      const to = byExternal.get(e.to)
      if (!from || !to) return null
      return { dependantId: from.id, dependencyId: to.id, weight: e.weight }
    })
    .filter((e): e is { dependantId: string; dependencyId: string; weight: number } => e !== null)

  if (edgeRows.length > 0) {
    await prisma.conceptDependency.createMany({ data: edgeRows })
  }

  return { conceptCount: created.length, edgeCount: edgeRows.length }
}

function errorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  if (typeof e === 'object' && e !== null && 'kind' in e) {
    return String((e as { kind: unknown }).kind)
  }
  return 'unknown error'
}
