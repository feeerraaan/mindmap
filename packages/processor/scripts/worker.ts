/**
 * MindMap worker - long-running process on the VPS that processes PARSE and
 * BUILD_GRAPH jobs. Run with tsx (e.g. `pnpm --filter . exec tsx scripts/worker.ts`).
 *
 * It replaces the in-process `after()` runner that the web app used to use.
 * Vercel serverless has no `pdftotext` and tight maxDuration; the worker
 * runs on the same machine that holds the uploaded originals (and has
 * `apt install poppler-utils`), so parsing is reliable and the LLM calls
 * for the knowledge graph aren't subject to serverless time limits.
 *
 * Concurrency: one job at a time. Claims are atomic via a conditional
 * UPDATE so scaling to multiple workers is a matter of starting more
 * processes.
 */
import './load-env.mjs'
import { prisma } from '@mindmap/database'
import { processParseJob, processBuildGraphJob } from '../src'
import { head as vercelHead } from '@vercel/blob'

const IDLE_POLL_MS = 2_000
const SHUTDOWN_GRACE_MS = 15_000
// A RUNNING job is considered abandoned once startedAt is older than this.
// 10 min is safely above the longest legit run (PDF parse + LLM graph build)
// so live jobs are never disturbed.
const STALE_JOB_MS = 10 * 60 * 1000

let running: Promise<void> | null = null
let stopRequested = false

async function readBytesFromBlob(blobKey: string): Promise<Uint8Array> {
  // blobKey is a Vercel Blob pathname (e.g. "documents/blob_xxx.pdf"). Use
  // the SDK to resolve it to the authoritative public URL (the subdomain
  // pattern is not safe to construct by hand - it's the store id without
  // the "store_" prefix and lowercased), then download the file.
  const token = process.env.MINDMAPBLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error('No BLOB token configured for the worker')
  }
  const meta = await vercelHead(blobKey, { token })
  const res = await fetch(meta.url)
  if (!res.ok) {
    throw new Error(`Fetch ${blobKey} failed: ${res.status}`)
  }
  const ab = await res.arrayBuffer()
  return new Uint8Array(ab)
}

async function claimNextJob() {
  // Pick the oldest QUEUED job, then atomically flip it to RUNNING only if
  // it's still QUEUED. The conditional update count guards against a
  // competing worker grabbing the same row between the SELECT and UPDATE.
  const candidate = await prisma.job.findFirst({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, documentId: true },
  })
  if (!candidate) return null
  const result = await prisma.job.updateMany({
    where: { id: candidate.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  if (result.count === 0) return null
  return candidate
}

async function markFailed(jobId: string, message: string) {
  await prisma.job.updateMany({
    where: { id: jobId },
    data: { status: 'FAILED', finishedAt: new Date(), error: message.slice(0, 1000) },
  })
}

async function enqueueBuildGraph(documentId: string) {
  await prisma.job.create({
    data: { type: 'BUILD_GRAPH', status: 'QUEUED', documentId, progress: 0 },
  })
}

async function processOne() {
  const job = await claimNextJob()
  if (!job) return false
  const log = `[worker ${job.type} ${job.id} doc=${job.documentId}]`
  console.log(`${log} claimed`)
  try {
    if (job.type === 'PARSE') {
      const result = await processParseJob({
        documentId: job.documentId,
        readBytes: readBytesFromBlob,
      })
      if (result.ok) {
        console.log(`${log} parsed ${result.chunkCount} chunks`)
        await enqueueBuildGraph(job.documentId)
      } else {
        console.warn(`${log} parse failed: ${result.error}`)
      }
    } else {
      const result = await processBuildGraphJob({ documentId: job.documentId })
      if (result.ok) {
        console.log(
          `${log} graph built: ${result.conceptCount} concepts, ${result.edgeCount} edges`,
        )
      } else {
        console.warn(`${log} build graph failed: ${result.error}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${log} threw: ${message}`)
    await markFailed(job.id, message).catch((e) => {
      console.error(`${log} could not mark FAILED:`, e)
    })
  }
  return true
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function reapStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_JOB_MS)
  const stale = await prisma.job.findMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    select: { id: true, type: true, documentId: true, startedAt: true },
  })
  for (const job of stale) {
    // Re-queue the job. Also reset the document if the processor left it
    // mid-flight (PARSING / GRAPHING) so the next run starts clean.
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: { status: 'QUEUED', startedAt: null, finishedAt: null, error: null, progress: 0 },
      }),
      prisma.document.updateMany({
        where: { id: job.documentId, status: { in: ['PARSING', 'GRAPHING'] } },
        data: { status: 'QUEUED' },
      }),
    ])
    console.warn(
      `[worker] reaped stale ${job.type} job ${job.id} doc=${job.documentId} (started ${job.startedAt?.toISOString()})`,
    )
  }
}

async function loop() {
  console.log(`[worker] started, blob source = vercel-blob`)
  while (!stopRequested) {
    try {
      await reapStaleJobs()
      const did = await processOne()
      if (!did) await sleep(IDLE_POLL_MS)
    } catch (err) {
      // A DB hiccup shouldn't kill the worker.
      console.error('[worker] loop error:', err)
      await sleep(IDLE_POLL_MS)
    }
  }
  console.log('[worker] loop exited')
}

function installSignalHandlers() {
  const shutdown = (signal: NodeJS.Signals) => {
    if (stopRequested) return
    console.log(`[worker] received ${signal}, draining (${SHUTDOWN_GRACE_MS}ms)…`)
    stopRequested = true
    setTimeout(() => {
      console.error('[worker] grace period elapsed, forcing exit')
      process.exit(1)
    }, SHUTDOWN_GRACE_MS).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

async function main() {
  installSignalHandlers()
  running = loop()
  await running
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
