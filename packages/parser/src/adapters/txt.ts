/**
 * Plain-text / markdown adapter — architecture-ready, disabled in MVP.
 * Listed but its supports() is broader; we keep it off for now to keep
 * the parse surface tight. Phase 8 can flip it on.
 */
import { Err, Ok, type Result } from '@mindmap/shared'
import type { ParsedDocument, DocumentChunk } from '@mindmap/types'
import type { ParserAdapter, ParseError, ParseInput } from '../types'

export const txtAdapter: ParserAdapter = {
  id: 'txt',
  // Disabled in MVP — the route handler's MIME allow-list is the gate.
  supports: () => false,
  async parse(): Promise<Result<ParsedDocument, ParseError>> {
    return Err({ kind: 'UnsupportedFormat', message: 'Plain text not yet enabled.' })
  },
}

// Reference the type so the file is part of the bundle once enabled.
export type _DocumentChunk = DocumentChunk
