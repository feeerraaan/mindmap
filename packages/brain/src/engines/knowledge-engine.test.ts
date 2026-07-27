import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setProviderRegistry, resetProviderRegistry } from '../providers/registry'
import { mockProvider } from '../providers/mock'
import { resetBudgets } from '../router'
import { buildGraph } from './knowledge-engine'
import type { ParsedDocument } from '@mindmap/types'

const TEXT = `
The mitochondrion is the powerhouse of the cell. It generates most of the chemical
energy needed to power the cell's biochemical reactions through ATP. The endoplasmic
reticulum, in contrast, is responsible for protein and lipid synthesis. Ribosomes
sit on the rough ER and translate mRNA into proteins. The Golgi apparatus then
modifies and packages those proteins for secretion or use within the cell. Lysosomes
contain digestive enzymes that break down waste materials. The nucleus houses DNA,
the cell's genetic material, and directs ribosome and protein synthesis.

Photosynthesis occurs in chloroplasts, which contain chlorophyll. Light reactions
in the thylakoid membranes produce ATP and NADPH. The Calvin cycle in the stroma
uses these to fix carbon dioxide into glucose. Cellular respiration is the reverse
process, breaking down glucose to release energy. Glycolysis splits glucose into
pyruvate in the cytoplasm. The Krebs cycle then completes oxidation in the
mitochondrial matrix. Oxidative phosphorylation uses the electron transport chain
to produce the bulk of ATP.

Enzymes are biological catalysts, usually proteins, that speed up reactions by
lowering activation energy. They have an active site that binds substrates.
The induced-fit model describes how the active site changes shape to fit the
substrate. Enzyme activity is affected by temperature, pH, and substrate
concentration. Inhibition can be competitive (blocking the active site) or
non-competitive (binding elsewhere).
`.trim()

const PARSED: ParsedDocument = {
  chunks: [{ index: 0, text: TEXT, page: 1, chapter: null }],
  pageCount: 3,
  language: null,
  metadata: {},
}

describe('buildGraph (mock provider)', () => {
  before(() => {
    resetBudgets()
    const provider = mockProvider({
      id: 'zen',
      available: true,
      defaultText: '',
      script: [
        { match: 'language classifier', text: '{"language":"en","confidence":0.99}' },
        {
          match: 'knowledge extractor',
          text: JSON.stringify({
            chapters: [
              {
                title: 'Cell biology',
                topics: [
                  {
                    title: 'Mitochondrion',
                    summary: 'The organelle that produces ATP via oxidative phosphorylation.',
                  },
                  {
                    title: 'Endoplasmic reticulum',
                    summary: 'Network of membranes for protein and lipid synthesis.',
                  },
                  {
                    title: 'Golgi apparatus',
                    summary: 'Modifies and packages proteins for secretion.',
                  },
                  { title: 'Nucleus', summary: 'Houses DNA and directs cell activity.' },
                ],
              },
              {
                title: 'Energy metabolism',
                topics: [
                  {
                    title: 'Photosynthesis',
                    summary: 'Converts light energy into chemical energy in chloroplasts.',
                  },
                  {
                    title: 'Cellular respiration',
                    summary: 'Breaks down glucose to release energy as ATP.',
                  },
                  {
                    title: 'Glycolysis',
                    summary: 'Splits glucose into pyruvate in the cytoplasm.',
                  },
                  {
                    title: 'Krebs cycle',
                    summary: 'Completes glucose oxidation in the mitochondrial matrix.',
                  },
                ],
              },
              {
                title: 'Enzymes',
                topics: [
                  {
                    title: 'Active site',
                    summary: 'Region of an enzyme that binds the substrate.',
                  },
                  {
                    title: 'Induced fit',
                    summary: 'Model where the active site changes shape to fit the substrate.',
                  },
                  {
                    title: 'Inhibition',
                    summary: 'Molecules that reduce enzyme activity, competitively or not.',
                  },
                ],
              },
            ],
          }),
        },
        {
          match: 'metadata estimator',
          text: JSON.stringify({
            items: [
              {
                chapterTitle: 'Cell biology',
                topicTitle: 'Mitochondrion',
                importance: 0.9,
                difficulty: 0.5,
              },
              {
                chapterTitle: 'Cell biology',
                topicTitle: 'Endoplasmic reticulum',
                importance: 0.6,
                difficulty: 0.5,
              },
              {
                chapterTitle: 'Cell biology',
                topicTitle: 'Golgi apparatus',
                importance: 0.5,
                difficulty: 0.4,
              },
              {
                chapterTitle: 'Cell biology',
                topicTitle: 'Nucleus',
                importance: 0.8,
                difficulty: 0.4,
              },
              {
                chapterTitle: 'Energy metabolism',
                topicTitle: 'Photosynthesis',
                importance: 0.7,
                difficulty: 0.6,
              },
              {
                chapterTitle: 'Energy metabolism',
                topicTitle: 'Cellular respiration',
                importance: 0.9,
                difficulty: 0.6,
              },
              {
                chapterTitle: 'Energy metabolism',
                topicTitle: 'Glycolysis',
                importance: 0.6,
                difficulty: 0.5,
              },
              {
                chapterTitle: 'Energy metabolism',
                topicTitle: 'Krebs cycle',
                importance: 0.6,
                difficulty: 0.6,
              },
              {
                chapterTitle: 'Enzymes',
                topicTitle: 'Active site',
                importance: 0.7,
                difficulty: 0.4,
              },
              {
                chapterTitle: 'Enzymes',
                topicTitle: 'Induced fit',
                importance: 0.6,
                difficulty: 0.5,
              },
              {
                chapterTitle: 'Enzymes',
                topicTitle: 'Inhibition',
                importance: 0.7,
                difficulty: 0.5,
              },
            ],
          }),
        },
        {
          match: 'dependency mapper',
          text: JSON.stringify({
            edges: [
              { from: 'c5', to: 'c6', weight: 0.9 },
              { from: 'c6', to: 'c7', weight: 0.7 },
              { from: 'c6', to: 'c8', weight: 0.6 },
              { from: 'c2', to: 'c1', weight: 0.5 },
              { from: 'c10', to: 'c9', weight: 0.6 },
              { from: 'c11', to: 'c9', weight: 0.6 },
            ],
          }),
        },
      ],
    })
    setProviderRegistry(
      new Map([
        ['zen', provider],
        ['go', mockProvider({ id: 'go', available: false })],
      ]),
    )
  })

  after(() => {
    resetProviderRegistry()
  })

  it('produces a knowledge graph with 11 concepts and acyclic edges', async () => {
    const stages: string[] = []
    const r = await buildGraph(PARSED, {
      userId: 'u-test',
      onProgress: (_f, stage) => stages.push(stage),
    })
    assert.equal(r.ok, true, `buildGraph failed: ${r.ok ? '' : JSON.stringify(r.error)}`)
    if (!r.ok) return
    assert.ok(
      r.value.graph.concepts.length >= 10,
      `expected ≥10 concepts, got ${r.value.graph.concepts.length}`,
    )
    for (const c of r.value.graph.concepts) {
      assert.ok(c.title.length > 0, `concept ${c.externalId} has empty title`)
      assert.ok(c.summary.length > 0, `concept ${c.externalId} has empty summary`)
    }
    assert.ok(r.value.graph.edges.length > 0, 'expected some dependency edges')
    assert.ok(
      stages.includes('extract-structure'),
      'progress should report extract-structure stage',
    )
  })

  it('recovers from a malformed JSON response (schema-repair retry)', async () => {
    resetProviderRegistry()
    resetBudgets()
    const flaky = mockProvider({
      id: 'zen',
      available: true,
      script: [
        { match: 'language classifier', text: '{"language":"en","confidence":0.99}' },
        { match: 'knowledge extractor', text: '__not_json__' },
        {
          match: 'knowledge extractor',
          text: JSON.stringify({
            chapters: [
              { title: 'Only chapter', topics: [{ title: 'Only topic', summary: 'A topic.' }] },
            ],
          }),
        },
        {
          match: 'metadata estimator',
          text: JSON.stringify({
            items: [
              {
                chapterTitle: 'Only chapter',
                topicTitle: 'Only topic',
                importance: 0.5,
                difficulty: 0.5,
              },
            ],
          }),
        },
        { match: 'dependency mapper', text: JSON.stringify({ edges: [] }) },
      ],
    })
    setProviderRegistry(
      new Map([
        ['zen', flaky],
        ['go', mockProvider({ id: 'go', available: false })],
      ]),
    )
    const r = await buildGraph(PARSED, { userId: 'u-flaky' })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.value.graph.concepts.length, 1)
  })
})
