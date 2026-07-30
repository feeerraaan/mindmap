/**
 * JobRunner - narrow interface for persisting a job row.
 *
 * The web app used to run jobs in-process with Next 16's `after()`. That
 * required the parser, the LLM, and `pdftotext` to be available inside
 * the Vercel serverless function - they aren't. Parsing and graph
 * building now run on the VPS worker (scripts/worker.ts), which polls
 * this same Postgres `Job` table. The web side just inserts a QUEUED
 * row and returns; the worker picks it up, processes it, and chains a
 * BUILD_GRAPH job after a successful PARSE.
 */
import { prisma } from '@mindmap/database'

export type JobKind = 'PARSE' | 'BUILD_GRAPH'

export interface JobRunner {
  enqueue(kind: JobKind, documentId: string): Promise<{ jobId: string }>
}

class DbEnqueueRunner implements JobRunner {
  async enqueue(kind: JobKind, documentId: string) {
    const job = await prisma.job.create({
      data: { type: kind, status: 'QUEUED', documentId, progress: 0 },
    })
    return { jobId: job.id }
  }
}

let runner: JobRunner | null = null
export function getRunner(): JobRunner {
  if (!runner) runner = new DbEnqueueRunner()
  return runner
}
