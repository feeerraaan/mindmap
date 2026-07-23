/**
 * Client-side Better Auth instance. Use in React components for hooks.
 */
import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.BETTER_AUTH_URL ?? 'http://localhost:3100')

export const authClient = createAuthClient({
  baseURL,
  plugins: [magicLinkClient()],
})

export const { signIn, signOut, useSession } = authClient
