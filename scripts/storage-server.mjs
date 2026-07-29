/**
 * Private blob storage service for MindMap document originals.
 *
 * Runs on the VPS (pm2 `mindmap-storage`, 127.0.0.1:3200) behind nginx with
 * TLS. The Vercel-hosted web app talks to it through the `VpsStorage` adapter
 * in apps/web/src/lib/storage.ts. Zero npm dependencies on purpose: this file
 * must run with a bare `node` on the VPS.
 *
 *   PUT    /blobs/:key   Bearer auth → persist bytes (atomic, 25 MB cap)
 *   GET    /blobs/:key   Bearer auth → stream bytes back
 *   DELETE /blobs/:key   Bearer auth → remove (idempotent)
 *   GET    /health       no auth     → liveness probe
 *
 * Env (loaded via `node --env-file=.env`):
 *   MINDMAP_STORAGE_TOKEN   shared secret with the web app (required)
 *   MINDMAP_LOCAL_BLOB_DIR  storage root (default /var/mindmap/blobs)
 *   STORAGE_PORT            listen port (default 3200)
 */
import { createServer } from 'node:http'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import path from 'node:path'

const PORT = Number(process.env.STORAGE_PORT ?? 3200)
const ROOT = process.env.MINDMAP_LOCAL_BLOB_DIR ?? '/var/mindmap/blobs'
const TOKEN = process.env.MINDMAP_STORAGE_TOKEN
const MAX_BYTES = 25 * 1024 * 1024

if (!TOKEN) {
  console.error('MINDMAP_STORAGE_TOKEN is required')
  process.exit(1)
}

function authorized(req) {
  const header = req.headers.authorization ?? ''
  const expected = `Bearer ${TOKEN}`
  if (header.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function resolveKey(raw) {
  if (!raw) return null
  let key
  try {
    key = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (key.startsWith('/') || key.includes('..') || key.includes('\\')) return null
  if (!/^[A-Za-z0-9._/-]+$/.test(key)) return null
  return { key, full: path.join(ROOT, key) }
}

async function handlePut(req, res, resolved) {
  const declared = Number(req.headers['content-length'] ?? 0)
  if (declared > MAX_BYTES) return json(res, 413, { error: 'too large' })

  await mkdir(path.dirname(resolved.full), { recursive: true })
  const tmp = `${resolved.full}.${randomUUID()}.tmp`
  const out = createWriteStream(tmp)
  let received = 0
  try {
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        received += chunk.length
        if (received > MAX_BYTES) {
          reject(Object.assign(new Error('too large'), { code: 'TOO_LARGE' }))
          req.destroy()
        }
      })
      req.on('error', reject)
      out.on('error', reject)
      out.on('finish', resolve)
      req.pipe(out)
    })
  } catch (err) {
    out.destroy()
    await unlink(tmp).catch(() => {})
    if (err.code === 'TOO_LARGE') return json(res, 413, { error: 'too large' })
    throw err
  }
  await rename(tmp, resolved.full)
  const s = await stat(resolved.full)
  json(res, 200, { ok: true, key: resolved.key, sizeBytes: s.size })
}

async function handleGet(res, resolved) {
  let s
  try {
    s = await stat(resolved.full)
  } catch (err) {
    if (err.code === 'ENOENT') return json(res, 404, { error: 'not found' })
    throw err
  }
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': s.size,
  })
  createReadStream(resolved.full).pipe(res)
}

async function handleDelete(res, resolved) {
  try {
    await unlink(resolved.full)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  json(res, 200, { ok: true })
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true })
  }
  if (!url.pathname.startsWith('/blobs/')) {
    return json(res, 404, { error: 'not found' })
  }
  if (!authorized(req)) {
    return json(res, 401, { error: 'unauthorized' })
  }
  const resolved = resolveKey(url.pathname.slice('/blobs/'.length))
  if (!resolved) return json(res, 400, { error: 'invalid key' })

  const run = async () => {
    if (req.method === 'PUT') return handlePut(req, res, resolved)
    if (req.method === 'GET') return handleGet(res, resolved)
    if (req.method === 'DELETE') return handleDelete(res, resolved)
    json(res, 405, { error: 'method not allowed' })
  }
  run().catch((err) => {
    console.error(`[storage] ${req.method} ${resolved.key} failed:`, err)
    if (!res.headersSent) json(res, 500, { error: 'internal' })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[storage] listening on 127.0.0.1:${PORT}, root ${ROOT}`)
})
