/**
 * PPTX adapter — uses jszip to unpack the .pptx (a zip of XML) and extracts
 * slide text from `ppt/slides/slide*.xml`. Best-effort; some charts/tables
 * are intentionally skipped in MVP.
 */
import { Err, Ok, type Result } from '@mindmap/shared'
import type { ParsedDocument, DocumentChunk } from '@mindmap/types'
import type { ParserAdapter, ParseError, ParseInput } from '../types'

const SLIDE_RE = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
const TAG_RE = /<[^>]+>/g

export const pptxAdapter: ParserAdapter = {
  id: 'pptx',
  supports: (m) =>
    m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  async parse(input: ParseInput): Promise<Result<ParsedDocument, ParseError>> {
    try {
      const JSZip = (await import('jszip')) as unknown as {
        default: new (buf: Buffer | Uint8Array) => {
          loadAsync: () => Promise<{
            files: Record<string, { async: (type: 'string') => Promise<string> }>
          }>
        }
      }
      const zip = await new JSZip.default(input.bytes).loadAsync()
      const slideFiles = Object.keys(zip.files)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
        .sort((a, b) => {
          const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0)
          const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0)
          return na - nb
        })

      const chunks: DocumentChunk[] = []
      for (let i = 0; i < slideFiles.length; i += 1) {
        const file = slideFiles[i]!
        const xml = await zip.files[file]!.async('string')
        const text = extractSlideText(xml)
        if (text.length > 0) {
          chunks.push({ index: i, text, page: i + 1, chapter: null })
        }
      }
      if (chunks.length === 0) {
        return Err({ kind: 'EmptyDocument', message: 'No text could be extracted from this PPTX.' })
      }
      return Ok({
        chunks,
        pageCount: slideFiles.length,
        language: null,
        metadata: { parser: 'jszip', slideCount: slideFiles.length },
      })
    } catch (e) {
      return Err({
        kind: 'Corrupted',
        message: `Could not read PPTX: ${e instanceof Error ? e.message : 'unknown error'}`,
      })
    }
  },
}

function extractSlideText(xml: string): string {
  // Pull all <a:t>...</a:t> text runs, strip tags, decode XML entities.
  const texts: string[] = []
  for (const m of xml.matchAll(SLIDE_RE)) {
    const raw = m[1] ?? ''
    const stripped = raw.replace(TAG_RE, '').trim()
    if (stripped.length > 0) texts.push(stripped)
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim()
}
