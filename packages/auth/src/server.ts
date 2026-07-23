/**
 * Server-side Better Auth instance.
 *
 * Uses Neon Postgres via the Prisma adapter. Email magic-link delivery is
 * stubbed for phase 1 — wire Resend in phase 3 when we need a real
 * "Sign in with email" path. The schema here matches the Better Auth
 * default; if you change the database models, update the plugin config.
 *
 * Import this in apps/web only. Client code should use `@mindmap/auth/client`.
 */
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { magicLink } from 'better-auth/plugins'
import { prisma } from '@mindmap/database'

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100'

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
)

const magicLinkEnabled = process.env.NODE_ENV !== 'production'

// `BETTER_AUTH_SECRET` is required at runtime. During `next build` we don't
// have it; we set a placeholder so module init doesn't throw. A real auth
// operation will still fail with a clear error at first request.
const secret = process.env.BETTER_AUTH_SECRET ?? 'build-time-placeholder-do-not-use'

export const auth = betterAuth({
  secret,
  baseURL,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID ?? '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        },
      }
    : {},
  plugins: [
    ...(magicLinkEnabled
      ? [
          magicLink({
            sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
              // In dev we log the URL AND stash the token separately so the
              // /api/dev/sign-in backdoor can read it (Better Auth hashes the
              // token before storing it, so the DB row is opaque).
              console.warn(`[magic-link] ${email} → ${url}`)
              if (process.env.NODE_ENV !== 'production') {
                try {
                  const { writeFile, mkdir } = await import('node:fs/promises')
                  const { tmpdir } = await import('node:os')
                  const dir = `${tmpdir()}/mindmap-magic-links`
                  await mkdir(dir, { recursive: true })
                  const ts = Date.now()
                  const safe = email.replace(/[^a-z0-9@.]/gi, '_')
                  await writeFile(`${dir}/${ts}-${safe}.txt`, url)
                } catch {
                  /* best-effort */
                }
              }
              // TODO(phase 3 production): call Resend SDK
            },
            expiresIn: 60 * 15,
          }),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    cookiePrefix: 'mindmap',
  },
  trustedOrigins: [baseURL],
})

export type Auth = typeof auth
