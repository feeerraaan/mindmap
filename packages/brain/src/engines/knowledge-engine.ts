/**
 * Knowledge Engine - phase 4.
 *
 * Pipeline (from docs/brain.md §5):
 *   1. classify.language(text)            → doc.language
 *   2. extract.structure(text)            → { chapters: [{ title, topics: [{ title, summary }] }] }
 *   3. extract.metadata(structure, text)  → importance/difficulty per topic
 *   4. (optional) summarize.concept per concept whose summary is short
 *   5. extract.relationships(concepts)    → edges between concept ids
 *   6. validate (Zod) + acyclic check
 *   7. return KnowledgeGraph { concepts, edges }
 *
 * Each step uses the router for provider selection, the prompts package for
 * templates, and the retry helper for schema-repair. Persistence lives in
 * `apps/web/features/documents/processor.ts`; this engine returns a graph
 * and never touches the DB.
 */
import type { KnowledgeGraph, ParsedDocument } from '@mindmap/types'
import type { BrainError } from '../errors'
import { Err, type Result } from '@mindmap/shared'
import { loadPrompt } from '@mindmap/prompts'
import {
  ClassifyLanguageSchema,
  ExtractMetadataSchema,
  ExtractRelationshipsSchema,
  ExtractStructureSchema,
  type ClassifyLanguage,
  type ExtractMetadata,
  type ExtractRelationships,
  type ExtractStructure,
} from '../schemas/knowledge'
import { pickRoute, recordCallTokens, candidatesFor } from '../router'
import { getProvider } from '../providers/registry'
import type { ProviderAdapter } from '../providers/provider'
import { withSchemaRepair } from '../retry'
import { validateAcyclic } from './dag'

export interface KnowledgeBuildContext {
  userId: string
  /** Override the default provider/model (e.g. for tests). */
  override?: {
    provider?: ProviderAdapter
    /** When set, skip LLM calls and return this graph. Tests only. */
    cannedGraph?: KnowledgeGraph
  }
  /** Optional progress callback (0..1) for the JobRunner UI. */
  onProgress?: (fraction: number, stage: string) => void
  /** Optional budget override. */
  estimateTokensPerStage?: number
}

export interface KnowledgeBuildOutput {
  graph: KnowledgeGraph
  tokensIn: number
  tokensOut: number
  language: string
  /** Edges that were dropped by the DAG validator (cycles / unknown ids). */
  droppedEdges: number
}

const MAX_CONCEPTS = 80

/**
 * Split `text` into ≤N roughly-equal windows so we stay under the model's
 * context window. For a 30-page PDF (~60k chars) a single 16k-char window
 * usually suffices; we cap at 4 windows to bound the per-stage token spend.
 */
function chunkText(text: string, maxWindows = 4, windowSize = 16_000): string[] {
  if (text.length <= windowSize) return [text]
  const windows: string[] = []
  for (let i = 0; i < text.length && windows.length < maxWindows; i += windowSize) {
    windows.push(text.slice(i, i + windowSize))
  }
  return windows
}

/** Build a KnowledgeGraph from a parsed document. */
export async function buildGraph(
  doc: ParsedDocument,
  ctx: KnowledgeBuildContext,
): Promise<Result<KnowledgeBuildOutput, BrainError>> {
  if (ctx.override?.cannedGraph) {
    return Ok({
      graph: ctx.override.cannedGraph,
      tokensIn: 0,
      tokensOut: 0,
      language: doc.language ?? 'en',
      droppedEdges: 0,
    })
  }
  const fullText = doc.chunks
    .map((c) => c.text)
    .join('\n')
    .trim()
  if (fullText.length < 200) {
    return Err({
      kind: 'InvalidInput',
      message: 'Document has too little text to build a knowledge graph.',
    })
  }

  const providers = ctx.override?.provider ? [ctx.override.provider] : availableProviders(ctx)
  if (providers.length === 0) return Err({ kind: 'InvalidInput', message: 'No provider available' })

  ctx.onProgress?.(0.05, 'classify-language')

  // 1. Language
  let languageResult: Awaited<ReturnType<typeof runClassifyLanguage>> | null = null
  let provider: ProviderAdapter = providers[0]!
  for (const p of providers) {
    languageResult = await runClassifyLanguage(fullText, p, ctx)
    if (languageResult.ok) {
      provider = p
      break
    }
  }
  if (!languageResult?.ok) return languageResult!
  const language = languageResult.value.value.language
  let totalIn = languageResult.value.tokensIn
  let totalOut = languageResult.value.tokensOut

  ctx.onProgress?.(0.2, 'extract-structure')

  // 2. Structure
  let structureResult: Awaited<ReturnType<typeof runExtractStructure>> | null = null
  for (const p of providers) {
    structureResult = await runExtractStructure(fullText, language, p, ctx)
    if (structureResult.ok) {
      provider = p
      break
    }
  }
  if (!structureResult?.ok) return structureResult!
  const structure = structureResult.value.value
  totalIn += structureResult.value.tokensIn
  totalOut += structureResult.value.tokensOut

  // Flatten topics → concepts.
  const concepts = flattenToConcepts(structure)
  if (concepts.length === 0) {
    return Err({
      kind: 'InvalidInput',
      message: 'No topics extracted from document - extractor returned an empty outline.',
    })
  }
  // Truncate to MAX_CONCEPTS to keep the graph manageable.
  const kept = concepts.slice(0, MAX_CONCEPTS)

  ctx.onProgress?.(0.45, 'extract-metadata')

  // 3. Metadata
  const metadataResult = await runExtractMetadata(fullText, language, structure, provider, ctx)
  if (metadataResult.ok) {
    totalIn += metadataResult.value.tokensIn
    totalOut += metadataResult.value.tokensOut
    applyMetadata(kept, structure, metadataResult.value.value.items)
  } else {
    // Metadata is non-fatal; fall back to uniform priors.
    for (const c of kept) {
      c.importance = 0.5
      c.difficulty = 0.5
    }
  }

  ctx.onProgress?.(0.7, 'extract-relationships')

  // 4. Relationships
  const relsResult = await runExtractRelationships(kept, language, provider, ctx)
  if (relsResult.ok) {
    totalIn += relsResult.value.tokensIn
    totalOut += relsResult.value.tokensOut
  }
  const rawEdges = relsResult.ok ? relsResult.value.value.edges : []

  ctx.onProgress?.(0.9, 'validate')

  // 5. Validate + cycle rejection
  const candidate: KnowledgeGraph = {
    concepts: kept.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      externalId: c.externalId,
      title: c.title,
      summary: c.summary,
      importance: c.importance,
      difficulty: c.difficulty,
      chapter: c.chapter,
      topic: c.topic,
      createdAt: c.createdAt,
    })),
    edges: rawEdges,
  }
  const report = validateAcyclic(candidate)
  const graph: KnowledgeGraph = {
    concepts: candidate.concepts,
    edges: report.keptEdges,
  }
  const droppedEdges = report.rejectedEdges.length

  ctx.onProgress?.(1, 'ready')

  return Ok({
    graph,
    tokensIn: totalIn,
    tokensOut: totalOut,
    language,
    droppedEdges,
  })
}

interface InternalConcept {
  id: string
  documentId: string
  externalId: string
  title: string
  summary: string
  importance: number
  difficulty: number
  chapter: string | null
  topic: string | null
  createdAt: Date
}

function flattenToConcepts(structure: ExtractStructure): InternalConcept[] {
  const out: InternalConcept[] = []
  const now = new Date()
  let n = 0
  for (const ch of structure.chapters) {
    for (const tp of ch.topics) {
      n += 1
      out.push({
        id: `tmp-${n}`,
        documentId: '',
        externalId: `c${n}`,
        title: tp.title,
        summary: tp.summary,
        importance: 0.5,
        difficulty: 0.5,
        chapter: ch.title,
        topic: tp.title,
        createdAt: now,
      })
    }
  }
  return out
}

function applyMetadata(
  concepts: InternalConcept[],
  structure: ExtractStructure,
  items: ExtractMetadata['items'],
): void {
  const lookup = new Map<string, { importance: number; difficulty: number }>()
  for (const it of items) {
    lookup.set(`${it.chapterTitle}::${it.topicTitle}`, {
      importance: it.importance,
      difficulty: it.difficulty,
    })
  }
  for (const ch of structure.chapters) {
    for (const tp of ch.topics) {
      const match = lookup.get(`${ch.title}::${tp.title}`)
      const target = concepts.find((c) => c.chapter === ch.title && c.topic === tp.title)
      if (target && match) {
        target.importance = match.importance
        target.difficulty = match.difficulty
      }
    }
  }
}

function availableProviders(_ctx: KnowledgeBuildContext): ProviderAdapter[] {
  const seen = new Set<string>()
  const result: ProviderAdapter[] = []
  for (const c of candidatesFor('extract.structure')) {
    const key = `${c.provider}::${c.model}`
    if (seen.has(key)) continue
    seen.add(key)
    const provider = getProvider(c.provider)
    if (provider.isAvailable()) result.push(provider)
  }
  return result
}

async function _defaultProvider(ctx: KnowledgeBuildContext): Promise<ProviderAdapter> {
  const providers = availableProviders(ctx)
  if (providers.length === 0) {
    throw new Error('No provider available')
  }
  return providers[0]!
}

async function runClassifyLanguage(
  text: string,
  provider: ProviderAdapter,
  ctx: KnowledgeBuildContext,
): Promise<
  Result<
    {
      value: ClassifyLanguage
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const prompt = await loadPrompt('classify.language')
  if (!prompt) return Err({ kind: 'InvalidInput', message: 'Prompt classify.language missing.' })
  const window = chunkText(text, 1, 6_000)[0] ?? text.slice(0, 6_000)
  const user = prompt.render({ text: window })
  const res = await withSchemaRepair({
    provider,
    task: 'classify.language',
    schema: ClassifyLanguageSchema,
    buildRequest: (previous) => ({
      user: previous ? repairUserPrompt(user, previous.error) : user,
      model: pickModel(ctx, 'classify.language', provider.id),
      temperature: 0,
      maxTokens: 256,
      jsonMode: true,
    }),
  })
  if (!res.ok) return res
  recordCallTokens(
    { userId: ctx.userId, task: 'classify.language' },
    { provider: res.value.providerId, model: res.value.model },
    {
      text: '',
      tokensIn: res.value.tokensIn,
      tokensOut: res.value.tokensOut,
      model: res.value.model,
      provider: res.value.providerId,
    },
  )
  return Ok({
    value: res.value.value,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    providerId: res.value.providerId,
    model: res.value.model,
  })
}

async function runExtractStructure(
  text: string,
  language: string,
  provider: ProviderAdapter,
  ctx: KnowledgeBuildContext,
): Promise<
  Result<
    {
      value: ExtractStructure
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const prompt = await loadPrompt('extract.structure')
  if (!prompt) return Err({ kind: 'InvalidInput', message: 'Prompt extract.structure missing.' })
  const windows = chunkText(text)
  const joined = windows.join('\n\n[...]\n\n')
  const user = prompt.render({ text: joined, language })
  const res = await withSchemaRepair({
    provider,
    task: 'extract.structure',
    schema: ExtractStructureSchema,
    buildRequest: (previous) => ({
      user: previous ? repairUserPrompt(user, previous.error) : user,
      model: pickModel(ctx, 'extract.structure', provider.id),
      temperature: 0.2,
      maxTokens: 4096,
      jsonMode: true,
      timeoutMs: 90_000,
    }),
  })
  if (!res.ok) return res
  recordCallTokens(
    { userId: ctx.userId, task: 'extract.structure' },
    { provider: res.value.providerId, model: res.value.model },
    {
      text: '',
      tokensIn: res.value.tokensIn,
      tokensOut: res.value.tokensOut,
      model: res.value.model,
      provider: res.value.providerId,
    },
  )
  return Ok({
    value: res.value.value,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    providerId: res.value.providerId,
    model: res.value.model,
  })
}

async function runExtractMetadata(
  text: string,
  language: string,
  structure: ExtractStructure,
  provider: ProviderAdapter,
  ctx: KnowledgeBuildContext,
): Promise<
  Result<
    {
      value: ExtractMetadata
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const prompt = await loadPrompt('extract.metadata')
  if (!prompt) return Err({ kind: 'InvalidInput', message: 'Prompt extract.metadata missing.' })
  const user = prompt.render({
    text: chunkText(text, 1, 4_000)[0] ?? '',
    language,
    structure: JSON.stringify(structure, null, 2),
  })
  const res = await withSchemaRepair({
    provider,
    task: 'extract.metadata',
    schema: ExtractMetadataSchema,
    buildRequest: (previous) => ({
      user: previous ? repairUserPrompt(user, previous.error) : user,
      model: pickModel(ctx, 'extract.metadata', provider.id),
      temperature: 0.1,
      maxTokens: 1024,
      jsonMode: true,
    }),
  })
  if (!res.ok) return res
  recordCallTokens(
    { userId: ctx.userId, task: 'extract.metadata' },
    { provider: res.value.providerId, model: res.value.model },
    {
      text: '',
      tokensIn: res.value.tokensIn,
      tokensOut: res.value.tokensOut,
      model: res.value.model,
      provider: res.value.providerId,
    },
  )
  return Ok({
    value: res.value.value,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    providerId: res.value.providerId,
    model: res.value.model,
  })
}

async function runExtractRelationships(
  concepts: InternalConcept[],
  language: string,
  provider: ProviderAdapter,
  ctx: KnowledgeBuildContext,
): Promise<
  Result<
    {
      value: ExtractRelationships
      tokensIn: number
      tokensOut: number
      providerId: string
      model: string
    },
    BrainError
  >
> {
  const prompt = await loadPrompt('extract.relationships')
  if (!prompt)
    return Err({ kind: 'InvalidInput', message: 'Prompt extract.relationships missing.' })
  const simplified = concepts.map((c) => ({
    id: c.externalId,
    title: c.title,
    chapter: c.chapter,
    topic: c.topic,
  }))
  const user = prompt.render({ concepts: JSON.stringify(simplified, null, 2), language })
  const res = await withSchemaRepair({
    provider,
    task: 'extract.relationships',
    schema: ExtractRelationshipsSchema,
    buildRequest: (previous) => ({
      user: previous ? repairUserPrompt(user, previous.error) : user,
      model: pickModel(ctx, 'extract.relationships', provider.id),
      temperature: 0.1,
      maxTokens: 2048,
      jsonMode: true,
      timeoutMs: 60_000,
    }),
  })
  if (!res.ok) return res
  recordCallTokens(
    { userId: ctx.userId, task: 'extract.relationships' },
    { provider: res.value.providerId, model: res.value.model },
    {
      text: '',
      tokensIn: res.value.tokensIn,
      tokensOut: res.value.tokensOut,
      model: res.value.model,
      provider: res.value.providerId,
    },
  )
  return Ok({
    value: res.value.value,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    providerId: res.value.providerId,
    model: res.value.model,
  })
}

function pickModel(
  ctx: KnowledgeBuildContext,
  task: Parameters<typeof pickRoute>[0]['task'],
  providerId?: string,
): string {
  const d = pickRoute({ userId: ctx.userId, task })
  if (d.ok && (!providerId || d.value.provider === providerId)) return d.value.model
  if (providerId) {
    for (const c of candidatesFor(task)) {
      if (c.provider === providerId) return c.model
    }
  }
  return process.env.OPENCODE_ZEN_MODEL ?? 'deepseek-v4-flash'
}

function repairUserPrompt(original: string, error: string): string {
  return `${original}\n\nIMPORTANT: Your previous response did not match the required JSON schema. Error: ${error}\n\nReturn ONLY a JSON object that matches the schema. No prose, no markdown fences.`
}

function Ok<T>(v: T): Result<T, never> {
  return { ok: true, value: v }
}
