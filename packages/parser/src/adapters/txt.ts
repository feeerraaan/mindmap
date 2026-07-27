import { Ok, type Result } from '@mindmap/shared'
import type { ParsedDocument, DocumentChunk } from '@mindmap/types'
import type { ParserAdapter, ParseError, ParseInput } from '../types'

const SUPPORTED = new Set(['text/plain', 'text/markdown'])

export const txtAdapter: ParserAdapter = {
  id: 'txt',
  supports: (mime: string) => SUPPORTED.has(mime),
  async parse(input: ParseInput): Promise<Result<ParsedDocument, ParseError>> {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const text = decoder.decode(input.bytes)

    const chunks: DocumentChunk[] = text
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((block, i) => ({
        index: i,
        text: block.trim(),
        page: null,
        chapter: null,
      }))

    return Ok({
      chunks,
      pageCount: null,
      language: null,
      metadata: { filename: input.filename, mimeType: input.mimeType },
    })
  },
}
