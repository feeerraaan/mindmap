/**
 * Loads versioned prompt templates from `packages/prompts/prompts/*.md`.
 *
 * Each prompt file has YAML frontmatter with `id`, `version`, `task`, `inputs`,
 * `output`, and an optional `providerHint`. The body is a Mustache template
 * that is rendered via `renderPrompt(prompt, vars)`.
 */
import { readFile, readdir } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import Mustache from 'mustache'
import type { ProviderId, TaskType } from '@mindmap/types'

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

function resolvePromptsDir(): string {
  // In development, import.meta.url points to the source file.
  // In production (Next.js), the compiled JS is in .next/server/... so we
  // walk up until we find the packages/prompts/prompts directory.
  const fromMeta = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prompts')
  try {
    readdirSync(fromMeta)
    return fromMeta
  } catch {
    // Fallback: walk up from cwd to find the prompts directory.
    const parts = process.cwd().split('/').filter(Boolean)
    for (let i = parts.length; i >= 0; i--) {
      const candidate = '/' + parts.slice(0, i).join('/') + '/packages/prompts/prompts'
      try {
        readdirSync(candidate)
        return candidate
      } catch {
        continue
      }
    }
    return fromMeta
  }
}

const PROMPTS_DIR = resolvePromptsDir()

let cache: Map<string, LoadedPrompt> | null = null

async function buildCache(): Promise<Map<string, LoadedPrompt>> {
  const out = new Map<string, LoadedPrompt>()
  let entries: string[]
  try {
    entries = await readdir(PROMPTS_DIR)
  } catch {
    return out
  }
  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    const filePath = join(PROMPTS_DIR, name)
    const raw = await readFile(filePath, 'utf8')
    const parsed = matter(raw)
    const data = parsed.data as Partial<PromptFrontmatter>
    if (!data.id || !data.task || typeof data.version !== 'number') continue
    const fm: PromptFrontmatter = {
      id: data.id,
      version: data.version,
      task: data.task,
      inputs: Array.isArray(data.inputs) ? (data.inputs as string[]) : [],
      output: typeof data.output === 'string' ? data.output : '',
      ...(data.providerHint ? { providerHint: data.providerHint } : {}),
    }
    const body = parsed.content
    out.set(fm.id, {
      frontmatter: fm,
      body,
      render: (vars) => Mustache.render(body, vars),
    })
  }
  return out
}

async function getCache(): Promise<Map<string, LoadedPrompt>> {
  if (!cache) cache = await buildCache()
  return cache
}

export async function loadPrompt(id: string): Promise<LoadedPrompt | null> {
  const map = await getCache()
  return map.get(id) ?? null
}

export async function loadAllPrompts(): Promise<LoadedPrompt[]> {
  const map = await getCache()
  return [...map.values()]
}

/** Test-only: clear the in-memory cache so new files are picked up. */
export function _resetPromptCache(): void {
  cache = null
}
