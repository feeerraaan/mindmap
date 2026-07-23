/**
 * User preferences — locale and theme — stored in cookies so the first paint
 * is correct (no flash). The DB User record is the source of truth at sign-in
 * time; cookies keep the SSR/CSR view consistent between sessions.
 */
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { Locale } from '@mindmap/types'

export const LocaleCookieSchema = z.enum(['en', 'es'])
export const ThemeCookieSchema = z.enum(['light', 'dark', 'system'])

const LOCALE_COOKIE = 'mindmap-locale'
const THEME_COOKIE = 'mindmap-theme'

const ONE_YEAR = 60 * 60 * 24 * 365

export async function getLocaleCookie(): Promise<Locale> {
  const c = await cookies()
  const raw = c.get(LOCALE_COOKIE)?.value
  const parsed = LocaleCookieSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'en'
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const c = await cookies()
  c.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  })
}

export async function getThemeCookie(): Promise<'light' | 'dark' | 'system'> {
  const c = await cookies()
  const raw = c.get(THEME_COOKIE)?.value
  const parsed = ThemeCookieSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'system'
}

export async function setThemeCookie(
  theme: 'light' | 'dark' | 'system',
): Promise<void> {
  const c = await cookies()
  c.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  })
}

/**
 * Narrow a raw `string` (from `params.locale`) to our typed locale.
 * Falls back to the default if the value is unexpected — Next.js only
 * matches our route for known locales, so this is a belt-and-braces cast.
 */
export function asLocale(value: string | undefined): Locale {
  return value === 'es' ? 'es' : 'en'
}
