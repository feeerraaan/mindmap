/**
 * DOCX adapter — uses mammoth for raw-text extraction.
 */
import { Err, Ok, type Result } from '@mindmap/shared'
import type { ParsedDocument } from '@mindmap/types'
import type { ParserAdapter, ParseError, ParseInput } from '../types'

export const docxAdapter: ParserAdapter = {
  id: 'docx',
  supports: (m) => m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  async parse(input: ParseInput): Promise<Result<ParsedDocument, ParseError>> {
    try {
      const mammoth = (await import('mammoth')) as unknown as {
        extractRawText: (input: {
          buffer: Buffer
        }) => Promise<{ value: string; messages: unknown[] }>
      }
      const buf = Buffer.from(input.bytes)
      const result = await mammoth.extractRawText({ buffer: buf })
      const text = (result.value ?? '').trim()
      if (text.length === 0) {
        return Err({ kind: 'EmptyDocument', message: 'No text could be extracted from this DOCX.' })
      }
      return Ok({
        chunks: [{ index: 0, text, page: null, chapter: null }],
        pageCount: null,
        language: null,
        metadata: { parser: 'mammoth', messages: result.messages.length },
      })
    } catch (e) {
      return Err({
        kind: 'Corrupted',
        message: `Could not read DOCX: ${e instanceof Error ? e.message : 'unknown error'}`,
      })
    }
  },
}
