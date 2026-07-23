/**
 * Loads versioned prompt templates. The actual prompt files live in
 * packages/prompts/prompts/ and are plain Markdown + YAML frontmatter.
 *
 * This file is a stub for phase 1 — real prompt files are added in phase 4.
 * We define the loader interface so packages/brain can already reference it.
 */

import type { TaskType } from '@mindmap/types'

export interface PromptFrontmatter {
  id: string
  version: number
  task: TaskType
  inputs: string[]
  providerHint?: 'zen' | 'go'
}

export interface LoadedPrompt {
  frontmatter: PromptFrontmatter
  body: string
}

export async function loadPrompt(_id: string): Promise<LoadedPrompt | null> {
  // Real implementation reads the file from `prompts/<id>.md` and parses
  // frontmatter with `gray-matter`. Phase 1 ships a stub so the package
  // type-checks and the dependency graph is intact.
  return null
}

export async function loadAllPrompts(): Promise<LoadedPrompt[]> {
  return []
}
