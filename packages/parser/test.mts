/* Standalone smoke test for the parser package. Run with:
 *   pnpm --filter @mindmap/parser exec tsx /root/mindmap/packages/parser/test.mts
 */
import { parseDocument } from './src/index.ts'

const empty = await parseDocument({
  bytes: new Uint8Array(0),
  mimeType: 'application/pdf',
  filename: 'x.pdf',
})
console.log('empty PDF:', empty.ok ? 'ok' : empty.error)

const unsupported = await parseDocument({
  bytes: new Uint8Array(100),
  mimeType: 'image/png',
  filename: 'x.png',
})
console.log('unsupported:', unsupported.ok ? 'ok' : unsupported.error.kind)

const tooBig = await parseDocument({
  bytes: new Uint8Array(26 * 1024 * 1024),
  mimeType: 'application/pdf',
  filename: 'big.pdf',
})
console.log('tooBig:', tooBig.ok ? 'ok' : tooBig.error.kind)

// Build a synthetic PDF — a real minimal PDF is non-trivial to craft; instead
// feed a buffer that pdf-parse will reject. We assert the adapter returns
// a structured error (not a throw).
const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]) // %PDF-1.4
const corrupted = await parseDocument({
  bytes: fakePdf,
  mimeType: 'application/pdf',
  filename: 'corrupt.pdf',
})
console.log('corrupted PDF:', corrupted.ok ? 'ok' : corrupted.error.kind)
