/**
 * Parser package — public API.
 *
 * `parseDocument(input)` is the single entry point. It dispatches to a
 * registered `ParserAdapter` based on the MIME type. Adapters live in
 * `./adapters/*` and are self-registered at module load.
 */
import type { ParsedDocument } from '@mindmap/types'
import { Err, type Result } from '@mindmap/shared'
import type { ParserAdapter, ParseError, ParseInput } from './types'

export type { ParserAdapter, ParseError, ParseInput }

import { pdfAdapter } from './adapters/pdf'
import { docxAdapter } from './adapters/docx'
import { pptxAdapter } from './adapters/pptx'
import { txtAdapter } from './adapters/txt'

const adapters: ParserAdapter[] = [pdfAdapter, docxAdapter, pptxAdapter, txtAdapter]

function pickAdapter(mimeType: string): ParserAdapter | null {
  return adapters.find((a) => a.supports(mimeType)) ?? null
}

const MAX_BYTES = 25 * 1024 * 1024
const MIN_TEXT_CHARS = 8

export async function parseDocument(input: ParseInput): Promise<Result<ParsedDocument, ParseError>> {
  if (input.bytes.byteLength === 0) {
    return Err({ kind: 'EmptyDocument', message: 'The file is empty.' })
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    return Err({ kind: 'TooLarge', message: 'Files up to 25 MB are supported.' })
  }
  const adapter = pickAdapter(input.mimeType)
  if (!adapter) {
    return Err({
      kind: 'UnsupportedFormat',
      message: `Format ${input.mimeType} is not supported.`,
    })
  }
  const result = await adapter.parse(input)
  if (result.ok) {
    const text = result.value.chunks.map((c) => c.text).join('\n').trim()
    if (text.length < MIN_TEXT_CHARS) {
      return Err({
        kind: 'EmptyDocument',
        message: 'We could not extract readable text from this file. If it is a scanned PDF, OCR is not yet supported.',
      })
    }
  }
  return result
}
