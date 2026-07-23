import { readFile } from 'node:fs/promises'
import { parseDocument } from './src/index.ts'

const path = process.argv[2] ?? '/tmp/real.pdf'
const bytes = await readFile(path)
console.log('Loaded', bytes.byteLength, 'bytes from', path)
const result = await parseDocument({ bytes, mimeType: 'application/pdf', filename: path.split('/').pop() ?? 'doc.pdf' })
console.log('result:', JSON.stringify(result, null, 2).slice(0, 2000))
