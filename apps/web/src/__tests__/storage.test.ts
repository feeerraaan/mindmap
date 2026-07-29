import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV_KEYS = [
  'MINDMAP_STORAGE_URL',
  'MINDMAP_STORAGE_TOKEN',
  'BLOB_READ_WRITE_TOKEN',
  'MINDMAPBLOB_READ_WRITE_TOKEN',
  'MINDMAP_LOCAL_BLOB_DIR',
  'VERCEL',
] as const

async function freshStorage() {
  vi.resetModules()
  const mod = await import('@/lib/storage')
  return mod.getStorage()
}

describe('getStorage provider selection', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('prefers VPS storage when URL and token are set', async () => {
    process.env.MINDMAP_STORAGE_URL = 'https://storage.example.com/'
    process.env.MINDMAP_STORAGE_TOKEN = 'secret'
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel-token'
    const storage = await freshStorage()
    expect(storage.id).toBe('vps')
  })

  it('falls back to Vercel Blob when only the blob token is set', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel-token'
    const storage = await freshStorage()
    expect(storage.id).toBe('vercel-blob')
  })

  it('falls back to Vercel Blob under the prefixed MINDMAPBLOB_READ_WRITE_TOKEN', async () => {
    process.env.MINDMAPBLOB_READ_WRITE_TOKEN = 'vercel-token'
    const storage = await freshStorage()
    expect(storage.id).toBe('vercel-blob')
  })

  it('prefers BLOB_READ_WRITE_TOKEN when both are set', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'plain'
    process.env.MINDMAPBLOB_READ_WRITE_TOKEN = 'prefixed'
    const storage = await freshStorage()
    expect(storage.id).toBe('vercel-blob')
  })

  it('uses local FS outside Vercel when nothing is configured', async () => {
    process.env.MINDMAP_LOCAL_BLOB_DIR = '/tmp/mindmap-test-blobs'
    const storage = await freshStorage()
    expect(storage.id).toBe('local-fs')
  })

  it('fails loudly on Vercel without any storage env', async () => {
    process.env.VERCEL = '1'
    await expect(async () => freshStorage()).rejects.toThrow(/MINDMAP_STORAGE_URL/)
  })

  it('generates safe keys for the VPS adapter', async () => {
    process.env.MINDMAP_STORAGE_URL = 'https://storage.example.com'
    process.env.MINDMAP_STORAGE_TOKEN = 'secret'
    const storage = await freshStorage()
    const key = storage.newKey('My Document.PDF')
    expect(key).toMatch(/^blob_[A-Za-z0-9_-]+\.pdf$/)
    expect(key).not.toContain('..')
  })
})
