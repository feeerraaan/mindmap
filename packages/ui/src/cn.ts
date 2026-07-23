/**
 * `cn` — combines class names with `clsx` + `tailwind-merge` semantics
 * suitable for Tailwind v4. Re-exported here for convenience.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
