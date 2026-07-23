/**
 * `cn` — class name combiner. A tiny version of shadcn's helper that takes
 * the inputs we use: strings, falsy, and `{ [class]: boolean }` maps.
 *
 * Why a re-implementation? Because `clsx`/`tailwind-merge` belong to packages/ui
 * (where they're pulled by shadcn) and to apps/web (where they're pulled by
 * the page). `packages/shared` is leaf and pulls nothing; here we just need
 * to combine strings.
 */
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | Record<string, boolean | null | undefined>
  | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === 'string' || typeof input === 'number') {
      out.push(String(input))
    } else if (Array.isArray(input)) {
      const inner = cn(...input)
      if (inner) out.push(inner)
    } else if (typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (input[key]) out.push(key)
      }
    }
  }
  return out.join(' ')
}
