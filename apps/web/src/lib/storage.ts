/**
 * Storage provider — abstracts where uploaded document bytes live.
 *
 * Three implementations:
 *   - VpsStorage        (production — set MINDMAP_STORAGE_URL + MINDMAP_STORAGE_TOKEN)
 *   - VercelBlobStorage (alternative for Vercel — set BLOB_READ_WRITE_TOKEN)
 *   - LocalFsStorage    (dev / preview — set MINDMAP_LOCAL_BLOB_DIR)
 *
 * VpsStorage points at scripts/storage-server.mjs running on the VPS, so
 * document originals stay on our own disk instead of a third-party store.
 * The selection order in getStorage() is: VPS → Vercel Blob → local FS.
 *
 * The `blobKey` we persist in the Document row is an opaque token whose
 * meaning is owned by the storage adapter:
 *   - LocalFsStorage    → relative path under MINDMAP_LOCAL_BLOB_DIR
 *   - VpsStorage        → same relative path, resolved on the VPS
 *   - VercelBlobStorage → full public URL returned by `@vercel/blob` put()
 *
 * Resolving a `blobKey` for read / delete always goes through this module.
 *
 * On Vercel the filesystem is read-only outside `/tmp`, so falling back to
 * LocalFsStorage there would silently break uploads. `getStorage()` detects
 * `process.env.VERCEL === '1'` and fails loudly if neither MINDMAP_STORAGE_URL
 * nor BLOB_READ_WRITE_TOKEN is set instead.
 */
import { mkdir, readFile, writeFile, stat, unlink } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { Buffer } from 'node:buffer'
import { Readable, PassThrough } from 'node:stream'
import path from 'node:path'
import { put as vercelPut, del as vercelDel, head as vercelHead } from '@vercel/blob'
import { newId } from '@mindmap/shared'

export interface StorageProvider {
  readonly id: 'vps' | 'vercel-blob' | 'local-fs'
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
  /** Remove the object for a key. Idempotent — missing keys are not an error. */
  delete(key: string): Promise<void>
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

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
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

  async put(input: {
    bytes: Uint8Array
    mimeType: string
    filename: string
    key?: string
  }): Promise<{ key: string; sizeBytes: number }> {
    const pathname = input.key ?? this.newKey(input.filename)
    const result = await vercelPut(pathname, Buffer.from(input.bytes), {
      // @vercel/blob only supports 'public' — the private-blob beta was
      // discontinued and the SDK throws if access is anything else. The URL
      // stays unguessable (random id in the pathname), and reads go through
      // head() → downloadUrl anyway.
      access: 'public',
      contentType: input.mimeType,
      addRandomSuffix: false,
    })
    return { key: result.url, sizeBytes: input.bytes.byteLength }
  }

  async get(key: string): Promise<Uint8Array> {
    const downloadUrl = await this.signedDownloadUrl(key)
    const res = await fetch(downloadUrl)
    if (!res.ok) {
      throw new Error(`Vercel Blob GET ${key} failed: ${res.status} ${res.statusText}`)
    }
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
  }

  stream(key: string): NodeJS.ReadableStream {
    const passthrough = new PassThrough()
    this.signedDownloadUrl(key)
      .then((url) => fetch(url))
      .then((res) => {
        if (!res.ok || !res.body) {
          passthrough.destroy(
            new Error(`Vercel Blob GET ${key} failed: ${res.status} ${res.statusText}`),
          )
          return
        }
        const node = Readable.fromWeb(
          res.body as unknown as import('node:stream/web').ReadableStream,
        )
        node.on('error', (e: Error) => passthrough.destroy(e))
        node.pipe(passthrough)
      })
      .catch((e: unknown) => passthrough.destroy(e as Error))
    return passthrough
  }

  async delete(key: string): Promise<void> {
    try {
      await vercelDel(key)
    } catch (err) {
      if (err instanceof Error && err.name === 'BlobNotFoundError') return
      throw err
    }
  }

  newKey(filename: string): string {
    const id = newId('blob')
    const ext = path.extname(filename).toLowerCase() || ''
    return `documents/${id}${ext}`
  }

  private async signedDownloadUrl(key: string): Promise<string> {
    const meta = await vercelHead(key)
    return meta.downloadUrl
  }
}

class VpsStorage implements StorageProvider {
  readonly id = 'vps' as const
  private readonly baseUrl: string

  constructor(
    baseUrl: string,
    private readonly token: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  async put(input: {
    bytes: Uint8Array
    mimeType: string
    filename: string
    key?: string
  }): Promise<{ key: string; sizeBytes: number }> {
    const key = input.key ?? this.newKey(input.filename)
    const res = await fetch(this.url(key), {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': input.mimeType,
      },
      body: Buffer.from(input.bytes),
    })
    if (!res.ok) {
      throw new Error(`VPS storage PUT ${key} failed: ${res.status} ${res.statusText}`)
    }
    return { key, sizeBytes: input.bytes.byteLength }
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.fetchBlob(key)
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
  }

  stream(key: string): NodeJS.ReadableStream {
    const passthrough = new PassThrough()
    this.fetchBlob(key)
      .then((res) => {
        const node = Readable.fromWeb(
          res.body as unknown as import('node:stream/web').ReadableStream,
        )
        node.on('error', (e: Error) => passthrough.destroy(e))
        node.pipe(passthrough)
      })
      .catch((e: unknown) => passthrough.destroy(e as Error))
    return passthrough
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.url(key), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.token}` },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`VPS storage DELETE ${key} failed: ${res.status} ${res.statusText}`)
    }
  }

  newKey(filename: string): string {
    const id = newId('blob')
    const ext = path.extname(filename).toLowerCase() || ''
    return `${id}${ext}`
  }

  private url(key: string): string {
    return `${this.baseUrl}/blobs/${encodeURI(key)}`
  }

  private async fetchBlob(key: string): Promise<Response> {
    const res = await fetch(this.url(key), {
      headers: { authorization: `Bearer ${this.token}` },
    })
    if (!res.ok || !res.body) {
      throw new Error(`VPS storage GET ${key} failed: ${res.status} ${res.statusText}`)
    }
    return res
  }
}

let cached: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (cached) return cached
  const vpsUrl = process.env.MINDMAP_STORAGE_URL
  const vpsToken = process.env.MINDMAP_STORAGE_TOKEN
  if (vpsUrl && vpsToken) {
    cached = new VpsStorage(vpsUrl, vpsToken)
    return cached
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (token && token.length > 0) {
    cached = new VercelBlobStorage()
    return cached
  }
  if (process.env.VERCEL === '1') {
    throw new Error(
      'No storage configured. Set MINDMAP_STORAGE_URL + MINDMAP_STORAGE_TOKEN ' +
        'to use the VPS storage service, or BLOB_READ_WRITE_TOKEN for Vercel Blob. ' +
        'Local disk is not an option on Vercel: the filesystem is read-only outside /tmp.',
    )
  }
  const root = process.env.MINDMAP_LOCAL_BLOB_DIR ?? '/var/mindmap/blobs'
  cached = new LocalFsStorage(root)
  return cached
}
