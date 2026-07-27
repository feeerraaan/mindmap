/**
 * Storage provider — abstracts where uploaded document bytes live.
 *
 * Two implementations:
 *   - VercelBlobStorage  (production)
 *   - LocalFsStorage     (dev / preview)
 *
 * The local FS adapter writes under $MINDMAP_LOCAL_BLOB_DIR (default
 * /var/mindmap/blobs). The Vercel Blob adapter is a stub for phase 3;
 * activating it requires only setting BLOB_READ_WRITE_TOKEN.
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { newId } from '@mindmap/shared'

export interface StorageProvider {
  readonly id: 'vercel-blob' | 'local-fs'
  /** Persist `bytes` and return the key used. If `key` is provided, the
   *  bytes are stored under that exact key (idempotent re-upload). */
  put(input: {
    bytes: Uint8Array
    mimeType: string
    filename: string
    key?: string
  }): Promise<{ key: string; sizeBytes: number }>
  /** Read the bytes for a key. Throws if the key is not found. */
  get(key: string): Promise<Uint8Array>
  /** Stream for large reads; not used yet but part of the interface. */
  stream(key: string): NodeJS.ReadableStream
  /** Generate a key without persisting — used by the router. */
  newKey(filename: string): string
}

class LocalFsStorage implements StorageProvider {
  readonly id = 'local-fs' as const
  constructor(private readonly root: string) {}

  async put(input: {
    bytes: Uint8Array
    filename: string
    key?: string
  }): Promise<{ key: string; sizeBytes: number }> {
    const key = input.key ?? this.newKey(input.filename)
    const full = this.resolve(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, input.bytes)
    const s = await stat(full)
    return { key, sizeBytes: s.size }
  }

  async get(key: string): Promise<Uint8Array> {
    const buf = await readFile(this.resolve(key))
    return new Uint8Array(buf)
  }

  stream(key: string): NodeJS.ReadableStream {
    return createReadStream(this.resolve(key))
  }

  newKey(filename: string): string {
    const id = newId('blob')
    const ext = path.extname(filename).toLowerCase() || ''
    return `${id}${ext}`
  }

  private resolve(key: string): string {
    if (key.includes('..')) throw new Error('Invalid storage key')
    return path.join(this.root, key)
  }
}

class VercelBlobStorage implements StorageProvider {
  readonly id = 'vercel-blob' as const

  async put(_input: {
    bytes: Uint8Array
    filename: string
    key?: string
  }): Promise<{ key: string; sizeBytes: number }> {
    throw new Error(
      'VercelBlobStorage not implemented (phase 3 stub). Set BLOB_READ_WRITE_TOKEN to use it.',
    )
  }
  async get(): Promise<Uint8Array> {
    throw new Error('VercelBlobStorage not implemented (phase 3 stub).')
  }
  stream(): NodeJS.ReadableStream {
    throw new Error('VercelBlobStorage not implemented (phase 3 stub).')
  }
  newKey(filename: string): string {
    const id = newId('blob')
    const ext = path.extname(filename).toLowerCase() || ''
    return `${id}${ext}`
  }
}

let cached: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (cached) return cached
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (token && token.length > 0) {
    cached = new VercelBlobStorage()
  } else {
    const root = process.env.MINDMAP_LOCAL_BLOB_DIR ?? '/var/mindmap/blobs'
    cached = new LocalFsStorage(root)
  }
  return cached
}
