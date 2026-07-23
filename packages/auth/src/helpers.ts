/**
 * Auth helpers used by Server Components, Server Actions, and Route Handlers.
 *
 * - `getSession()` reads the current session from the request cookie.
 * - `requireUser()` throws if no session (use in protected RSC).
 * - `requireUserOrRedirect()` is the variant for RSC where we want to
 *    redirect to /sign-in instead of throwing.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './server'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSession>>>['user']

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  return session?.user ?? null
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireUserOrRedirect(callbackPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    const path = callbackPath
      ? `/sign-in?callbackPath=${encodeURIComponent(callbackPath)}`
      : '/sign-in'
    redirect(path)
  }
  // redirect() is typed as `never`, so TS should narrow `user` to non-null
  // after the if-block. The cast below is a belt-and-braces guarantee.
  return user as CurrentUser
}
