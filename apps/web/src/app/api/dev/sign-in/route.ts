import { NextResponse, type NextRequest } from 'next/server'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * GET /api/dev/sign-in?email=...&callbackPath=/en/mind
 *
 * DEV ONLY — If a pending magic link exists, uses it. Otherwise, requests
 * a new magic link first, then reads the file it creates.
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

  // First, try to find an existing magic link
  let magicUrl = await findMagicLink(dir, email)

  // If none exists, request one via the Better Auth magic-link endpoint
  if (!magicUrl) {
    const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100'
    const signInRes = await fetch(`${baseURL}/api/auth/sign-in/magic-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!signInRes.ok) {
      return NextResponse.json(
        { error: `Failed to request magic link for ${email}.` },
        { status: 500 },
      )
    }
    // Wait a moment for the file to be written
    await new Promise((r) => setTimeout(r, 200))
    magicUrl = await findMagicLink(dir, email)
  }

  if (!magicUrl) {
    return NextResponse.json(
      { error: `No pending magic link for ${email}. Request one first.` },
      { status: 404 },
    )
  }

  // Replace localhost with the actual host from the request so the
  // magic link verify URL points to the right origin.
  const requestHost = req.headers.get('host') ?? 'localhost:3100'
  const requestOrigin = `${url.protocol}//${requestHost}`
  const verifyUrl = magicUrl.replace(/http:\/\/localhost:\d+/, requestOrigin)

  // Replace the callbackURL on the magic URL so the verify redirects
  // where the user actually wants to go (e.g. /en/mind).
  const u = new URL(verifyUrl)
  u.searchParams.set('callbackURL', callbackPath)
  const verifyRes = await fetch(u.toString(), { redirect: 'manual' })

  const headers = new Headers()
  for (const [k, v] of verifyRes.headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') headers.append('set-cookie', v)
  }
  let location = verifyRes.headers.get('location') ?? callbackPath
  // Replace localhost in the redirect location too
  location = location.replace(/http:\/\/localhost:\d+/, requestOrigin)
  // If location is just a path, prepend the request origin
  if (location.startsWith('/')) {
    location = requestOrigin + location
  }
  headers.set('location', location)
  return new Response(null, { status: 302, headers })
}

async function findMagicLink(dir: string, email: string): Promise<string | null> {
  let files: string[] = []
  try {
    files = await readdir(dir)
  } catch {
    return null
  }
  const safe = email.replace(/[^a-z0-9@.]/gi, '_')
  const candidates = files
    .filter((f) => f.endsWith(`-${safe}.txt`))
    .sort()
    .reverse()
  if (candidates.length === 0) return null
  const file = path.join(dir, candidates[0]!)
  const content = (await readFile(file, 'utf8')).trim()
  // Consume the file so the next request creates a new one.
  await unlink(file).catch(() => {})
  return content
}
