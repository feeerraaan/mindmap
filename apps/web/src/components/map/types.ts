/**
 * Server-rendered props for the knowledge map. Built by the RSC; passed
 * to the client `KnowledgeMap` component.
 */
export interface KnowledgeMapNode {
  id: string
  title: string
  summary: string
  chapter: string | null
  topic: string | null
  importance: number
  difficulty: number
  mastery: number
  confidence: number
  attempts: number
  correct: number
  lastDelta: number | null
  lastSeen: string | null
  dueAt: string | null
}

export interface KnowledgeMapEdge {
  id: string
  source: string
  target: string
  weight: number
}

export type MapFilter = 'all' | 'known' | 'thinkIKnow' | 'dontKnow' | 'aboutToForget'

export interface KnowledgeMapData {
  documentId: string
  documentName: string
  nodes: KnowledgeMapNode[]
  edges: KnowledgeMapEdge[]
  globalConfidence: number
  totals: {
    known: number
    thinkIKnow: number
    dontKnow: number
    aboutToForget: number
  }
}
