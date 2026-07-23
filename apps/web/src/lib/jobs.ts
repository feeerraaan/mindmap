/**
 * JobRunner — small, in-process queue.
 *
 * Phase 3 ships an in-process runner using Next 16's `after()` so a parse
 * continues after the HTTP response has been flushed. The interface is
 * intentionally narrow so phase 7 can swap in Inngest / QStash by
 * implementing `JobRunner` against a different transport.
 */
import { after } from 'next/server'
import { prisma } from '@mindmap/database'
import { processDocument } from '@/features/documents/processor'

export type JobKind = 'PARSE'

export interface JobRunner {
  enqueue(kind: JobKind, documentId: string): Promise<{ jobId: string }>
}

class InProcessRunner implements JobRunner {
  async enqueue(kind: JobKind, documentId: string) {
    const job = await prisma.job.create({
      data: { type: kind, status: 'QUEUED', documentId, progress: 0 },
    })
    after(async () => {
      try {
        if (kind === 'PARSE') {
          await processDocument({ documentId })
        }
      } catch (e) {
        // processor already wrote the FAILED status + error; nothing more to do
        // beyond logging so the queue doesn't silently swallow.
        // eslint-disable-next-line no-console
        console.error(`[job ${job.id}] failed:`, e instanceof Error ? e.message : e)
      }
    })
    return { jobId: job.id }
  }
}

let runner: JobRunner | null = null
export function getRunner(): JobRunner {
  if (!runner) runner = new InProcessRunner()
  return runner
}
