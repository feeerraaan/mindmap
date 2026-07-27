import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateAcyclic } from './dag'
import type { KnowledgeGraph } from '@mindmap/types'

function concept(id: string): KnowledgeGraph['concepts'][number] {
  return {
    id: `c-${id}`,
    documentId: 'doc-1',
    externalId: id,
    title: `Concept ${id}`,
    summary: `Summary for ${id}`,
    importance: 0.5,
    difficulty: 0.5,
    chapter: 'Ch',
    topic: 'Tp',
    createdAt: new Date(),
  }
}

describe('validateAcyclic', () => {
  it('keeps a clean DAG untouched', () => {
    const graph: KnowledgeGraph = {
      concepts: [concept('c1'), concept('c2'), concept('c3')],
      edges: [
        { from: 'c1', to: 'c2', weight: 0.8 },
        { from: 'c2', to: 'c3', weight: 0.5 },
      ],
    }
    const r = validateAcyclic(graph)
    assert.equal(r.hasCycle, false)
    assert.equal(r.keptEdges.length, 2)
    assert.equal(r.rejectedEdges.length, 0)
  })

  it('drops edges that would close a cycle', () => {
    const graph: KnowledgeGraph = {
      concepts: [concept('c1'), concept('c2'), concept('c3')],
      edges: [
        { from: 'c1', to: 'c2', weight: 0.8 },
        { from: 'c2', to: 'c3', weight: 0.5 },
        { from: 'c3', to: 'c1', weight: 0.7 },
      ],
    }
    const r = validateAcyclic(graph)
    assert.equal(r.hasCycle, true)
    assert.equal(r.keptEdges.length, 2)
    assert.equal(r.rejectedEdges.length, 1)
    assert.equal(r.rejectedEdges[0]?.from, 'c3')
  })

  it('rejects self-loops and unknown endpoints', () => {
    const graph: KnowledgeGraph = {
      concepts: [concept('c1'), concept('c2')],
      edges: [
        { from: 'c1', to: 'c1', weight: 1 },
        { from: 'c1', to: 'c9', weight: 1 },
        { from: 'c2', to: 'c1', weight: 1 },
      ],
    }
    const r = validateAcyclic(graph)
    assert.equal(r.keptEdges.length, 1)
    assert.equal(r.rejectedEdges.length, 2)
  })

  it('handles an empty edge list', () => {
    const r = validateAcyclic({ concepts: [concept('c1')], edges: [] })
    assert.equal(r.hasCycle, false)
    assert.equal(r.keptEdges.length, 0)
  })
})
