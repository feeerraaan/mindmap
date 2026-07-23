import { randomBytes } from 'node:crypto'

/**
 * Generates a URL-safe, sortable id with a short prefix.
 * Uses crypto.randomBytes; never use Math.random for ids.
 */
export function newId(prefix: string = ''): string {
  const ts = Date.now().toString(36)
  const rand = randomBytes(8).toString('base64url')
  const id = `${ts}${rand}`
  return prefix ? `${prefix}_${id}` : id
}

/**
 * Cuid-like id (collision-resistant, sortable). Same shape Prisma uses by default,
 * but we don't depend on Prisma in shared.
 */
export function cuid(): string {
  return newId('c')
}
