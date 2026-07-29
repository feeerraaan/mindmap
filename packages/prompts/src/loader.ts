/**
 * Loads versioned prompt templates.
 *
 * In production, prompts are embedded in the bundle via generated-prompts.ts.
 * In development, they can also be read from the file system.
 */
import matter from 'gray-matter'
import Mustache from 'mustache'
import type { ProviderId, TaskType } from '@mindmap/types'
import { PROMPTS, type StoredPrompt } from './generated-prompts'

export interface PromptFrontmatter {
  id: string
  version: number
  task: TaskType
  inputs: string[]
  output: string
  providerHint?: ProviderId
}

export interface LoadedPrompt {
  frontmatter: PromptFrontmatter
  body: string
  /** Render the template body with the given variables. */
  render(vars: Record<string, unknown>): string
}

let cache: Map<string, LoadedPrompt> | null = null

function buildCache(): Map<string, LoadedPrompt> {
  const out = new Map<string, LoadedPrompt>()
  for (const stored of Object.values(PROMPTS)) {
    const fm: PromptFrontmatter = {
      id: stored.id,
      version: stored.version,
      task: stored.task as TaskType,
      inputs: stored.inputs,
      output: stored.output,
      ...(stored.providerHint ? { providerHint: stored.providerHint as ProviderId } : {}),
    }
    const body = stored.body
    out.set(fm.id, {
      frontmatter: fm,
      body,
      render: (vars) => Mustache.render(body, vars),
    })
  }
  return out
}

function getCache(): Map<string, LoadedPrompt> {
  if (!cache) cache = buildCache()
  return cache
}

export async function loadPrompt(id: string): Promise<LoadedPrompt | null> {
  const map = getCache()
  return map.get(id) ?? null
}

export async function loadAllPrompts(): Promise<LoadedPrompt[]> {
  const map = getCache()
  return [...map.values()]
}

/** Test-only: clear the in-memory cache so new files are picked up. */
export function _resetPromptCache(): void {
  cache = null
}
