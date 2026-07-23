import type { ParsedDocument } from '@mindmap/types'
import type { Result } from '@mindmap/shared'

export interface ParseInput {
  bytes: Uint8Array
  mimeType: string
  filename: string
}

export type ParseError = {
  kind: 'UnsupportedFormat' | 'EmptyDocument' | 'Corrupted' | 'TooLarge'
  message: string
}

export interface ParserAdapter {
  id: string
  supports(mimeType: string): boolean
  parse(input: ParseInput): Promise<Result<ParsedDocument, ParseError>>
}
