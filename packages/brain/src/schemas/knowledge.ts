/**
 * Zod schemas for every LLM output. The knowledge engine validates each LLM
 * response against the matching schema; a failure triggers a schema-repair
 * retry (see `../retry.ts`).
 */
import { z } from 'zod'

export const ClassifyLanguageSchema = z.object({
  language: z.string().min(2).max(8),
  confidence: z.number().min(0).max(1),
})
export type ClassifyLanguage = z.infer<typeof ClassifyLanguageSchema>

export const ConceptSummarySchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).max(800),
})
export type ConceptSummary = z.infer<typeof ConceptSummarySchema>

export const TopicOutlineSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
})

export const ChapterOutlineSchema = z.object({
  title: z.string().min(1),
  topics: z.array(TopicOutlineSchema).min(1),
})

export const ExtractStructureSchema = z.object({
  chapters: z.array(ChapterOutlineSchema).min(1).max(20),
})
export type ExtractStructure = z.infer<typeof ExtractStructureSchema>

export const ExtractMetadataItemSchema = z.object({
  chapterTitle: z.string().min(1),
  topicTitle: z.string().min(1),
  importance: z.number().min(0).max(1),
  difficulty: z.number().min(0).max(1),
})

export const ExtractMetadataSchema = z.object({
  items: z.array(ExtractMetadataItemSchema).min(1),
})
export type ExtractMetadata = z.infer<typeof ExtractMetadataSchema>

export const ExtractRelationshipsSchema = z.object({
  edges: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      weight: z.number().min(0).max(1),
    }),
  ),
})
export type ExtractRelationships = z.infer<typeof ExtractRelationshipsSchema>

/**
 * Strip a JSON object from an LLM response. Handles three shapes:
 *  - raw JSON
 *  - ```json ... ``` fences
 *  - prose followed by JSON
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence && fence[1]) return parseLoose(fence[1].trim())
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  const candidates = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b)
  if (candidates.length === 0) throw new Error('No JSON object or array in LLM response')
  const start = candidates[0]!
  return parseLoose(trimmed.slice(start))
}

function parseLoose(s: string): unknown {
  // Try strict first, then a tolerant walk: balance braces / brackets.
  try {
    return JSON.parse(s)
  } catch {
    /* fall through */
  }
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') depth += 1
    else if (c === '}' || c === ']') {
      depth -= 1
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end === -1) throw new Error('Unbalanced JSON in LLM response')
  return JSON.parse(s.slice(0, end))
}
