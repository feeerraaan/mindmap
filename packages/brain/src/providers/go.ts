import { openAiCompatibleAdapter } from './openai-compatible'

const DEFAULT_GO_MODEL = process.env.OPENCODE_GO_MODEL ?? 'mimo-2.5-class'

export function goAdapter() {
  return openAiCompatibleAdapter({
    provider: 'go',
    baseUrl: process.env.OPENCODE_GO_BASE_URL ?? '',
    apiKey: process.env.OPENCODE_GO_KEY,
    defaultModel: DEFAULT_GO_MODEL,
  })
}
