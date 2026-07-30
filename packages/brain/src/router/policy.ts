/**
 * Router policy - single fast path for all users.
 *
 * Primary: deepseek-v4-flash on Go.
 * Fallback: ling-3.0-flash-free on Zen.
 */
import type { ProviderId, TaskType } from '@mindmap/types'

export interface Candidate {
  provider: ProviderId
  model: string
  temperature?: number
  maxTokens?: number
}

const GO_MODEL = process.env.OPENCODE_GO_MODEL ?? 'deepseek-v4-flash'
const FALLBACK_MODEL = 'deepseek-v4-flash-free'

const primaryWith = (overrides: Partial<Candidate>): Candidate[] => [
  { provider: 'go', model: GO_MODEL, ...overrides },
  { provider: 'zen', model: FALLBACK_MODEL, ...overrides },
]

export const POLICY: Record<TaskType, Candidate[]> = {
  'classify.language': primaryWith({ temperature: 0 }),
  'classify.topic': primaryWith({ temperature: 0.1 }),
  'extract.structure': primaryWith({ temperature: 0.2, maxTokens: 4096 }),
  'extract.metadata': primaryWith({ temperature: 0.1 }),
  'extract.relationships': primaryWith({ temperature: 0.1 }),
  'summarize.concept': primaryWith({ temperature: 0.3, maxTokens: 512 }),
  'reason.diagnose': primaryWith({ temperature: 0.4, maxTokens: 4096 }),
  'reason.evaluate': primaryWith({ temperature: 0.2 }),
  'reason.clarify': primaryWith({ temperature: 0.3 }),
  'schedule.review': [],
}

export function candidatesFor(task: TaskType): Candidate[] {
  return POLICY[task] ?? []
}
