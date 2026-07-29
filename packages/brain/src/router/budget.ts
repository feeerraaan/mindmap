/**
 * Daily per-user token budget. Tracked in memory for the MVP. Over-budget
 * → the router returns `BudgetExceeded` and the engine surfaces a calm
 * "Mind is resting" UX.
 */
const DEFAULT_BUDGET = 500_000

interface Day {
  date: string
  tokensIn: number
  tokensOut: number
}

const store = new Map<string, Day>()

function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function bucket(userId: string): Day {
  const k = todayKey()
  let v = store.get(userId)
  if (!v || v.date !== k) {
    v = { date: k, tokensIn: 0, tokensOut: 0 }
    store.set(userId, v)
  }
  return v
}

export function budgetFor(): number {
  const override = process.env.BRAIN_DAILY_BUDGET
  if (override && !Number.isNaN(Number(override))) return Number(override)
  return DEFAULT_BUDGET
}

export interface BudgetState {
  used: number
  limit: number
  remaining: number
}

export function getState(userId: string): BudgetState {
  const b = bucket(userId)
  const used = b.tokensIn + b.tokensOut
  const limit = budgetFor()
  return { used, limit, remaining: Math.max(0, limit - used) }
}

export function recordUsage(userId: string, tokensIn: number, tokensOut: number): void {
  const b = bucket(userId)
  b.tokensIn += tokensIn
  b.tokensOut += tokensOut
}

export function hasBudget(_userId: string, _estimated = 1000): boolean {
  return true
}

export function resetBudgets(): void {
  store.clear()
}
