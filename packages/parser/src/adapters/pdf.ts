/**
 * PDF adapter - uses the system `pdftotext` (poppler-utils) binary.
 *
 * Trade-off: requires poppler-utils on the host. In return we get a
 * battle-tested extractor that handles every PDF variant we care about
 * (FlateDecode, LZW, image-only, etc) without an npm dependency.
 *
 * On Vercel: poppler is not available. For production we'll swap this
 * adapter for `pdfjs-dist` (already used internally by the AI SDK
 * ecosystem); for hackathon + dev, `pdftotext` is the right call.
 */
import { spawn } from 'node:child_process'
import { Err, Ok, type Result } from '@mindmap/shared'
import type { ParsedDocument, DocumentChunk } from '@mindmap/types'
import type { ParserAdapter, ParseError, ParseInput } from '../types'

interface PdftotextOutput {
  text: string
  pageCount: number
}

function pdftotext(buf: Buffer): Promise<PdftotextOutput> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pdftotext', ['-q', '-', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    proc.stderr.on('data', (d: Buffer) => (err += d.toString('utf8')))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pdftotext exited ${code}: ${err.trim()}`))
        return
      }
      const cleaned = cleanPdfText(out)
      const pages = cleaned.split('\f')
      resolve({ text: cleaned, pageCount: Math.max(1, pages.length - 1) })
    })
    proc.stdin.end(buf)
  })
}

function cleanPdfText(raw: string): string {
  const pages = raw.split('\f')
  return pages.map((page) => cleanPage(page)).join('\f')
}

function cleanPage(page: string): string {
  const lines = page.split('\n')
  const result: string[] = []
  let buf = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (buf) {
        result.push(buf)
        buf = ''
      }
      continue
    }
    if (buf === '') {
      buf = trimmed
      continue
    }
    const prev = buf
    const prevEndsSentence = /[.:;!?)]$/.test(prev)
    const prevIsList = /^[-•*]\s/.test(prev) || /^\d+[.)]\s/.test(prev)
    const curIsList = /^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)

    if (prevEndsSentence || prevIsList || curIsList) {
      result.push(buf)
      buf = trimmed
    } else {
      buf += ' ' + trimmed
    }
  }
  if (buf) result.push(buf)
  return result.join('\n')
}

export const pdfAdapter: ParserAdapter = {
  id: 'pdf',
  supports: (m) => m === 'application/pdf',
  async parse(input: ParseInput): Promise<Result<ParsedDocument, ParseError>> {
    try {
      const { text, pageCount } = await pdftotext(Buffer.from(input.bytes))
      const chunks: DocumentChunk[] = buildChunks(text, pageCount)
      return Ok({
        chunks,
        pageCount,
        language: null,
        metadata: { parser: 'pdftotext' },
      })
    } catch (e) {
      return Err({
        kind: 'Corrupted',
        message: `Could not read PDF: ${e instanceof Error ? e.message : 'unknown error'}`,
      })
    }
  },
}

function buildChunks(text: string, numPages: number): DocumentChunk[] {
  // pdftotext with -q emits \f between pages. If absent, single chunk.
  if (text.includes('\f') && numPages > 1) {
    const parts = text.split('\f')
    const chunks: DocumentChunk[] = []
    for (let i = 0; i < parts.length; i += 1) {
      const t = (parts[i] ?? '').trim()
      if (t.length > 0) chunks.push({ index: i, text: t, page: i + 1, chapter: null })
    }
    return chunks
  }
  return [{ index: 0, text: text.trim(), page: numPages || null, chapter: null }]
}
