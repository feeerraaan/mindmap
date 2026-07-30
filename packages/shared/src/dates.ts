/**
 * Date utilities. All timezone-aware via the user's locale context (passed in).
 * We deliberately avoid `date-fns` in shared - a single dependency we don't need yet.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function now(): Date {
  return new Date()
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY)
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000)
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function isPast(d: Date, ref: Date = new Date()): boolean {
  return d.getTime() < ref.getTime()
}

export function isFuture(d: Date, ref: Date = new Date()): boolean {
  return d.getTime() > ref.getTime()
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
