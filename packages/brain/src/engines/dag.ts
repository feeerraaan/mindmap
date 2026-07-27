/**
 * DAG validation for concept dependencies. Rejects cycles and self-loops so
 * the knowledge engine can keep a partial graph without producing a broken
 * model.
 */
import type { KnowledgeGraph } from '@mindmap/types'

export interface CycleReport {
  hasCycle: boolean
  rejectedEdges: { from: string; to: string; weight: number }[]
  keptEdges: { from: string; to: string; weight: number }[]
}

export function validateAcyclic(graph: KnowledgeGraph): CycleReport {
  const concepts = new Set(graph.concepts.map((c) => c.externalId))
  const byId = new Map(graph.concepts.map((c) => [c.externalId, c]))
  const kept: typeof graph.edges = []
  const rejected: typeof graph.edges = []
  for (const e of graph.edges) {
    if (!concepts.has(e.from) || !concepts.has(e.to) || e.from === e.to) {
      rejected.push(e)
      continue
    }
    if (
      createsCycle(
        e.from,
        e.to,
        graph.concepts.map((c) => c.externalId),
        kept,
      )
    ) {
      rejected.push(e)
      continue
    }
    kept.push(e)
  }
  // Build a fresh graph with the kept edges so we can return it.
  const filtered: KnowledgeGraph = {
    concepts: graph.concepts,
    edges: kept,
  }
  // Touch byId so unused-locals doesn't fire when this file is consumed
  // for types only.
  void byId
  return {
    hasCycle: rejected.length > 0,
    rejectedEdges: rejected,
    keptEdges: filtered.edges,
  }
}

function createsCycle(
  from: string,
  to: string,
  allNodes: string[],
  existing: { from: string; to: string }[],
): boolean {
  if (from === to) return true
  const adj = new Map<string, string[]>()
  for (const id of allNodes) adj.set(id, [])
  for (const e of existing) adj.get(e.from)?.push(e.to)
  adj.get(from)?.push(to)
  // BFS from `to` looking for `from`.
  const stack = [to]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (cur === from) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const n of adj.get(cur) ?? []) stack.push(n)
  }
  return false
}
