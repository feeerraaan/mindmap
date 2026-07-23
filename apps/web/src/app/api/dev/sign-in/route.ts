import { NextResponse, type NextRequest } from 'next/server'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * GET /api/dev/sign-in?email=...&callbackPath=/en/mind
 *
 * DEV ONLY — reads the most recent magic-link URL stashed by the dev
 * `sendMagicLink` override in `packages/auth/src/server.ts`. That override
 * writes the full verify URL to `$TMPDIR/mindmap-magic-links/<ts>-<email>.txt`
 * because Better Auth hashes the token before persisting it (so the DB
 * row is opaque). We follow the URL server-side to get the signed
 * Set-Cookie, then forward it to the browser.
 *
 * Production: 404 (no such route).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const url = new URL(req.url)
  const email = url.searchParams.get('email') ?? 'demo@mindmap.app'
  const callbackPath = url.searchParams.get('callbackPath') ?? '/en/mind'

  const dir = path.join(tmpdir(), 'mindmap-magic-links')
  let files: string[] = []
  try {
    files = await readdir(dir)
  } catch {
    return NextResponse.json(
      { error: 'No pending magic link. Request one first from the sign-in page.' },
      { status: 404 },
    )
  }
  const safe = email.replace(/[^a-z0-9@.]/gi, '_')
  const candidates = files
    .filter((f) => f.endsWith(`-${safe}.txt`))
    .sort()
    .reverse()
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: `No pending magic link for ${email}. Request one first.` },
      { status: 404 },
    )
  }
  const file = path.join(dir, candidates[0]!)
  const magicUrl = (await readFile(file, 'utf8')).trim()
  // Consume the file so the next request creates a new one.
  await unlink(file).catch(() => {})

  // Replace the callbackURL on the magic URL so the verify redirects
  // where the user actually wants to go (e.g. /en/upload).
  const u = new URL(magicUrl)
  u.searchParams.set('callbackURL', callbackPath)
  const verifyRes = await fetch(u.toString(), { redirect: 'manual' })

  const headers = new Headers()
  for (const [k, v] of verifyRes.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') headers.append('set-cookie', v)
  }
  const location = verifyRes.headers.get('location') ?? callbackPath
  headers.set('location', location)
  return new Response(null, { status: 302, headers })
}
