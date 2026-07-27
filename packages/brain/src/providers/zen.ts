import { openAiCompatibleAdapter } from './openai-compatible'

const DEFAULT_ZEN_MODEL = process.env.OPENCODE_ZEN_MODEL ?? 'deepseek-v4-flash'
const DEFAULT_GO_MODEL = process.env.OPENCODE_GO_MODEL ?? 'mimo-2.5-class'

export function zenAdapter() {
  return openAiCompatibleAdapter({
    provider: 'zen',
    baseUrl: process.env.OPENCODE_ZEN_BASE_URL ?? '',
    apiKey: process.env.OPENCODE_ZEN_KEY,
    defaultModel: DEFAULT_ZEN_MODEL,
  })
}

export function goAdapter() {
  return openAiCompatibleAdapter({
    provider: 'go',
    baseUrl: process.env.OPENCODE_GO_BASE_URL ?? '',
    apiKey: process.env.OPENCODE_GO_KEY,
    defaultModel: DEFAULT_GO_MODEL,
  })
}
