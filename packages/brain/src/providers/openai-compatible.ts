/**
 * OpenAI-compatible provider implementation, parameterised by env.
 *
 * Both `zen` and `go` are OpenCode endpoints reachable via
 * `@ai-sdk/openai-compatible`. This factory creates an adapter for either
 * one; the file is named for the first one but is generic.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import type { ProviderId } from '@mindmap/types'
import {
  ProviderError,
  ProviderMissingKey,
  ProviderRateLimited,
  type ChatRequest,
  type ChatResponse,
  type ProviderAdapter,
} from './provider'

export interface OpenAICompatibleEnv {
  provider: ProviderId
  baseUrl: string
  apiKey: string | undefined
  defaultModel: string
}

export function openAiCompatibleAdapter(env: OpenAICompatibleEnv): ProviderAdapter {
  if (!env.baseUrl) {
    throw new Error(`Provider ${env.provider} has no base URL configured.`)
  }
  const client = createOpenAICompatible({
    name: env.provider,
    baseURL: env.baseUrl,
    apiKey: env.apiKey ?? 'no-key',
    headers: {
      // OpenCode partners expose a header to disable training logging.
      'x-usage-log': 'false',
    },
  })
  return {
    id: env.provider,
    isAvailable: () => Boolean(env.apiKey && env.apiKey.length > 0),
    async chat(req: ChatRequest): Promise<ChatResponse> {
      if (!env.apiKey) throw new ProviderMissingKey(env.provider)
      const modelName = req.model || env.defaultModel
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 30_000)
      try {
        const result = await generateText({
          model: client(modelName),
          system: req.system ?? 'You are a helpful assistant. Respond in JSON.',
          prompt: req.user,
          temperature: req.temperature ?? 0.2,
          maxTokens: req.maxTokens ?? 2048,
          abortSignal: controller.signal,
        })
        return {
          text: result.text,
          tokensIn: result.usage?.promptTokens ?? 0,
          tokensOut: result.usage?.completionTokens ?? 0,
          model: modelName,
          provider: env.provider,
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (/429|rate.?limit/i.test(message)) {
          const m = message.match(/retry.?after\D*(\d+)/i)
          const retryAfterMs = m && m[1] ? Number(m[1]) * 1000 : 30_000
          throw new ProviderRateLimited(env.provider, retryAfterMs)
        }
        if (/api.?key|unauthori[sz]ed|401/i.test(message)) {
          throw new ProviderMissingKey(env.provider)
        }
        if (/402|insufficient.?balance|payment.?required/i.test(message)) {
          throw new ProviderRateLimited(env.provider, 60_000)
        }
        if (/abort|timeout/i.test(message)) {
          throw new ProviderError(env.provider, `Timeout after 30s waiting for ${env.provider}`)
        }
        throw new ProviderError(env.provider, message)
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
