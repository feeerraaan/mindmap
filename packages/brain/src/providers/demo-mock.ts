/**
 * Demo-mode mock provider. When `BRAIN_DEMO_MOCK=1` is set in the
 * environment, the brain routes every LLM call to a scripted mock that
 * returns calibrated canned responses for the diagnosis pipeline. This
 * lets the demo run end-to-end without spending real tokens, and it
 * keeps the engine code unchanged — the mock is provider-agnostic.
 *
 * Scripted responses:
 *   - `reason.diagnose.easy`  → a 4-option MCQ about the concept title
 *   - `reason.diagnose.hard`  → an open-ended question
 *   - `reason.evaluate`       → correctness 0.75 + "Yes, that's solid."
 *   - `reason.clarify`        → a short Socratic follow-up
 */
import type { ProviderAdapter } from './provider'

interface DemoScript {
  match: (user: string) => boolean
  build: (user: string) => string
}

function extractConceptTitle(user: string): string {
  // Match the "Title: <value>" line in the rendered prompt.
  const m = user.match(/Title:\s*([^\n]+)/)
  return m && m[1] ? m[1].trim() : 'the concept'
}

function firstQuestion(user: string): string {
  const title = extractConceptTitle(user)
  return JSON.stringify({
    prompt: `Which of the following best describes "${title}"?`,
    options: [
      `A precise definition of ${title}`,
      `A related but distinct idea`,
      `An example that does not fit ${title}`,
      `A common misconception about ${title}`,
    ],
    correctIndex: 0,
    difficulty: 0.0,
    microFeedback: "Yes, that's the one.",
  })
}

function firstHardQuestion(user: string): string {
  const title = extractConceptTitle(user)
  return JSON.stringify({
    prompt: `In your own words, how would you explain "${title}" to a peer?`,
    difficulty: 0.0,
    microFeedback: 'Thanks for your answer.',
  })
}

const SCRIPT: DemoScript[] = [
  { match: (u) => u.includes('EASY template'), build: firstQuestion },
  { match: (u) => u.includes('HARD template'), build: firstHardQuestion },
  {
    match: (u) => u.includes('answer evaluator'),
    build: () =>
      JSON.stringify({
        correctness: 0.75,
        isCorrect: true,
        rationale: 'The answer captures the gist of the concept.',
        microFeedback: "Yes, that's solid.",
      }),
  },
  {
    match: (u) => u.includes('Socratic clarifier'),
    build: () =>
      JSON.stringify({
        clarification: 'Could you say a little more about the why?',
        microFeedback: 'Quick follow-up.',
      }),
  },
]

let callCount = 0

export function demoMockProvider(): ProviderAdapter {
  return {
    id: 'zen',
    isAvailable: () => process.env.BRAIN_DEMO_MOCK === '1',
    async chat(req) {
      callCount += 1
      const hit = SCRIPT.find((s) => s.match(req.user))
      const text = hit ? hit.build(req.user) : JSON.stringify({ ok: true })
      return {
        text,
        tokensIn: Math.max(50, Math.floor(req.user.length / 4)),
        tokensOut: Math.max(20, Math.floor(text.length / 4)),
        model: req.model || 'demo-mock',
        provider: 'zen',
      }
    },
  }
}

export function _demoCallCount(): number {
  return callCount
}
