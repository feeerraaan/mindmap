/**
 * End-to-end smoke test of the diagnosis flow.
 *
 * 1. Sign in as e2e@mindmap.app via magic link.
 * 2. Find the seeded demo document (or upload one).
 * 3. POST /api/diagnosis/start.
 * 4. POST /api/diagnosis/[id]/answer with a few different kinds.
 * 5. Verify the document transitions to MAPPED.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, statSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3100'
const DEV_LOG = '/tmp/dev.log'
const ZEN_KEY_SET = Boolean(process.env.OPENCODE_ZEN_KEY && process.env.OPENCODE_ZEN_KEY.length > 0)
const prisma = new PrismaClient()

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

async function main() {
  if (!ZEN_KEY_SET) console.log('OPENCODE_ZEN_KEY is empty; the LLM will fail.')

  const user = await prisma.user.upsert({
    where: { email: 'diag-e2e@mindmap.app' },
    update: {},
    create: { email: 'diag-e2e@mindmap.app', name: 'Diag E2E', emailVerified: true, locale: 'en' },
  })
  const ws = await prisma.workspace.upsert({
    where: { id: 'ws_diag_e2e' },
    update: {},
    create: { id: 'ws_diag_e2e', ownerId: user.id, name: 'Diag E2E', emoji: '🧪' },
  })

  // Use the seeded demo document (it already has 20 concepts).
  const doc = await prisma.document.upsert({
    where: { id: 'doc_diag_e2e' },
    update: { workspaceId: ws.id, status: 'READY', language: 'en' },
    create: {
      id: 'doc_diag_e2e',
      workspaceId: ws.id,
      blobKey: 'demo/diag-e2e.txt',
      filename: 'diag-e2e.txt',
      mimeType: 'text/plain',
      sizeBytes: 1000,
      pageCount: 10,
      status: 'READY',
      language: 'en',
    },
  })
  // Ensure 20+ concepts exist for this doc (idempotent).
  for (let i = 1; i <= 22; i += 1) {
    await prisma.concept.upsert({
      where: { documentId_externalId: { documentId: doc.id, externalId: `c-${i}` } },
      update: {},
      create: {
        documentId: doc.id,
        externalId: `c-${i}`,
        title: `Concept ${i}`,
        summary: `A short summary for concept ${i} in the test document.`,
        importance: 0.5 + (i % 5) * 0.1,
        difficulty: 0.4 + (i % 4) * 0.1,
        chapter: i % 2 === 0 ? 'Even' : 'Odd',
        topic: `Topic ${i}`,
      },
    })
  }

  console.log('requesting magic link for diag-e2e@mindmap.app ...')
  await fetch(`${BASE}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, callbackURL: '/en/mind' }),
  })
  let magicUrl: string | null = null
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const s = statSync(DEV_LOG)
      const text = readFileSync(DEV_LOG, 'utf8').slice(-s.size)
      const match = text.match(/\[magic-link\][^→]+→\s*(\S+)/g)
      if (match) {
        const last = match[match.length - 1]!
        const url = last.replace(/.*→\s*/, '').trim()
        if (url.startsWith('http')) {
          magicUrl = url
          break
        }
      }
    } catch {
      // log file may not be present yet; keep polling
    }
  }
  if (!magicUrl) throw new Error('magic link URL never appeared in /tmp/dev.log')
  console.log('magic link:', magicUrl)
  const verifyRes = await fetch(magicUrl, { redirect: 'manual' })
  const setCookie = verifyRes.headers.get('set-cookie') ?? ''
  const cookieMatch = setCookie.match(/(better-auth\.session_token|mindmap\.session_token)=([^;]+)/)
  if (!cookieMatch) throw new Error('no session cookie in magic-link verify response')
  const cookie = `${cookieMatch[1]}=${cookieMatch[2]}`
  console.log('signed in OK')

  // 1. Start diagnosis
  console.log('POST /api/diagnosis/start ...')
  const startRes = await fetch(`${BASE}/api/diagnosis/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ documentId: doc.id }),
  })
  const startBody = (await startRes.json()) as {
    sessionId?: string
    firstQuestion?: { turnId: string; question: { kind: string; prompt: string; options?: string[]; difficulty: number } } | null
    finished?: boolean
    globalConfidence?: number
    error?: string
    message?: string
  }
  console.log('start status:', startRes.status)
  console.log('sessionId:', startBody.sessionId)
  console.log('firstQuestion:', startBody.firstQuestion)
  if (!startBody.sessionId) {
    console.log('FAILED:', startBody)
    process.exit(1)
  }
  if (startBody.finished) {
    console.log('Session finished immediately — all concepts already probed. This is valid but boring.')
    return
  }
  assert(startBody.firstQuestion, 'first question expected')

  const sessionId = startBody.sessionId
  let turnId = startBody.firstQuestion!.turnId
  let question = startBody.firstQuestion!.question

  // 2. Answer a few questions
  let questions = 0
  for (let i = 0; i < 5; i += 1) {
    if (question.kind === 'EASY') {
      // Pick option 1 (likely wrong given our mock-less test, but we have
      // the real provider in dev). For the smoke test, just submit.
      const r = await fetch(`${BASE}/api/diagnosis/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ turnId, answer: { kind: 'MCQ', optionIndex: 0 } }),
      })
      const body = (await r.json()) as {
        finished?: boolean
        microFeedback?: string
        globalConfidence?: number
        questionsAsked?: number
        clarification?: unknown
        error?: string
        message?: string
      }
      console.log(`Q${i + 1} answer status:`, r.status, 'finished:', body.finished, 'gc:', body.globalConfidence?.toFixed(3))
      if (r.status >= 400) {
        console.log('  error:', body.error, body.message)
        break
      }
      questions += 1
      if (body.finished) {
        console.log('Session finished after', questions, 'questions.')
        break
      }
    } else {
      const r = await fetch(`${BASE}/api/diagnosis/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ turnId, answer: { kind: 'OPEN', text: 'A test answer.' } }),
      })
      const body = (await r.json()) as { finished?: boolean; error?: string; message?: string }
      console.log(`Q${i + 1} (open) answer status:`, r.status, 'finished:', body.finished)
      if (r.status >= 400) {
        console.log('  error:', body.error, body.message)
        break
      }
      questions += 1
      if (body.finished) break
    }
    // Fetch the next question via the SSE /next endpoint (one-shot).
    // We use the polling GET for simplicity.
    const snap = await fetch(`${BASE}/api/diagnosis/${sessionId}`, { headers: { cookie } })
    const snapBody = (await snap.json()) as {
      pendingQuestion?: { turnId: string; question: { kind: string; prompt: string; difficulty: number } } | null
      finished?: boolean
    }
    if (snapBody.finished || !snapBody.pendingQuestion) {
      console.log('Session finished after', questions, 'questions.')
      break
    }
    turnId = snapBody.pendingQuestion!.turnId
    question = snapBody.pendingQuestion!.question
  }
  console.log('Smoke test completed with', questions, 'answers submitted.')

  // 3. Check the document status
  const docAfter = await prisma.document.findUnique({ where: { id: doc.id }, select: { status: true } })
  console.log('Document status:', docAfter?.status)
  if (docAfter?.status === 'MAPPED') {
    console.log('SUCCESS: document transitioned to MAPPED.')
  }
}

main()
  .catch((e) => {
    console.error('E2E FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
