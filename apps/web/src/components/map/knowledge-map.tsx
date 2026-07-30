'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ConceptNode, type ConceptNodeData } from './concept-node'
import { ConceptSidePanel } from './concept-side-panel'
import { MapFilters } from './map-filters'
import { ConceptListFallback } from './concept-list-fallback'
import type { KnowledgeMapData, MapFilter } from './types'

const nodeTypes = { concept: ConceptNode }

interface KnowledgeMapProps {
  data: KnowledgeMapData
  locale: 'en' | 'es'
  labels: {
    subtitle: string
    legendTitle: string
    known: string
    weak: string
    unknown: string
    sideTitle: string
    sideClose: string
    sideOpenInTimeline: string
    sideAttempts: string
    sideCorrect: string
    sideLastSeen: string
    sideDue: string
    sideDependsOn: string
    sideDependedBy: string
    filters: {
      all: string
      known: string
      thinkIKnow: string
      dontKnow: string
      aboutToForget: string
    }
    mobileHint: string
    empty: { title: string; body: string }
  }
  timelineHref: string
}

function classify(n: KnowledgeMapData['nodes'][number]): MapFilter {
  if (n.attempts === 0) return 'dontKnow'
  if (n.confidence < 0.4 && n.mastery < 0.5) return 'dontKnow'
  if (n.lastDelta !== null && n.lastDelta < -0.1) return 'aboutToForget'
  if (n.confidence < 0.6) return 'thinkIKnow'
  return 'known'
}

function bucketFor(filter: MapFilter, n: KnowledgeMapData['nodes'][number]): boolean {
  if (filter === 'all') return true
  if (filter === 'known') return n.mastery >= 0.6 && n.confidence >= 0.6
  if (filter === 'thinkIKnow') return n.mastery >= 0.4 && n.confidence < 0.6
  if (filter === 'dontKnow') return n.attempts === 0 || n.mastery < 0.4
  if (filter === 'aboutToForget') {
    if (n.lastDelta === null) return false
    return n.lastDelta < -0.05 && n.mastery < 0.7
  }
  return true
}

export function KnowledgeMap({ data, labels, timelineHref }: KnowledgeMapProps) {
  const [filter, setFilter] = useState<MapFilter>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() {
      setIsMobile(typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const buckets = useMemo(() => {
    const out = { all: data.nodes.length, known: 0, thinkIKnow: 0, dontKnow: 0, aboutToForget: 0 }
    for (const n of data.nodes) {
      const c = classify(n)
      if (c === 'known') out.known += 1
      else if (c === 'thinkIKnow') out.thinkIKnow += 1
      else if (c === 'dontKnow') out.dontKnow += 1
      else if (c === 'aboutToForget') out.aboutToForget += 1
    }
    return out
  }, [data])

  const visibleIds = useMemo(() => {
    const set = new Set<string>()
    for (const n of data.nodes) if (bucketFor(filter, n)) set.add(n.id)
    return set
  }, [data, filter])

  // Lay out: simple radial-ish - central nodes (most important) in the
  // middle, dependencies around them. This is not optimal but stable
  // and works for the MVP cap of ~80 nodes.
  const { nodes, edges } = useMemo(() => {
    const importanceRank = [...data.nodes].sort((a, b) => b.importance - a.importance)
    const positionById = new Map<string, { x: number; y: number }>()
    const center = { x: 0, y: 0 }
    const ringSize = 110
    importanceRank.forEach((n, i) => {
      if (i === 0) {
        positionById.set(n.id, center)
        return
      }
      const angle = (i / importanceRank.length) * Math.PI * 2
      const radius = ringSize * (1 + (i % 3))
      positionById.set(n.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
    })
    const flowNodes: Node<ConceptNodeData>[] = data.nodes.map((n) => {
      const pos = positionById.get(n.id) ?? center
      return {
        id: n.id,
        type: 'concept',
        position: pos,
        data: {
          title: n.title,
          mastery: n.mastery,
          confidence: n.confidence,
          attempts: n.attempts,
          importance: n.importance,
          isSelected: selected === n.id,
          isDimmed: !visibleIds.has(n.id),
        },
      }
    })
    const flowEdges: Edge[] = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
        type: 'default',
        style: { stroke: 'var(--color-border-strong)', strokeWidth: 1 + e.weight },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-border-strong)' },
      }))
    return { nodes: flowNodes, edges: flowEdges }
  }, [data, selected, visibleIds])

  const [internalNodes, setInternalNodes] = useState<Node<ConceptNodeData>[]>(nodes)
  useEffect(() => {
    setInternalNodes(nodes)
  }, [nodes])

  const onNodesChange = useMemo(
    () => (changes: NodeChange[]) =>
      setInternalNodes((nds) => applyNodeChanges(changes, nds) as Node<ConceptNodeData>[]),
    [],
  )

  if (data.nodes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center md:px-8">
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">{labels.empty.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{labels.empty.body}</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="px-4 py-6">
        <MapFilters
          current={filter}
          counts={buckets}
          labels={labels.filters}
          onChange={setFilter}
        />
        <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">{labels.mobileHint}</p>
        <ConceptListFallback
          data={data}
          filter={filter}
          bucketFor={bucketFor}
          onSelect={setSelected}
          selectedId={selected}
        />
        <AnimatePresence>
          {selected ? (
            <ConceptSidePanel
              data={data}
              selectedId={selected}
              onClose={() => setSelected(null)}
              timelineHref={timelineHref}
              labels={{
                title: labels.sideTitle,
                close: labels.sideClose,
                openInTimeline: labels.sideOpenInTimeline,
                attempts: labels.sideAttempts,
                correct: labels.sideCorrect,
                lastSeen: labels.sideLastSeen,
                due: labels.sideDue,
                dependsOn: labels.sideDependsOn,
                dependedBy: labels.sideDependedBy,
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-12rem)] min-h-[480px] w-full">
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <MapFilters
          current={filter}
          counts={buckets}
          labels={labels.filters}
          onChange={setFilter}
        />
        <Legend labels={labels} />
      </div>
      <ReactFlow
        nodes={internalNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        onNodeClick={(_, node) => setSelected(node.id)}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
      >
        <Background gap={24} size={1} color="var(--color-border-subtle)" />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="!rounded-lg !border !border-[var(--color-border)] !bg-[var(--color-bg)]/80 !backdrop-blur-xl !backdrop-saturate-150"
        />
      </ReactFlow>
      <AnimatePresence>
        {selected ? (
          <ConceptSidePanel
            data={data}
            selectedId={selected}
            onClose={() => setSelected(null)}
            timelineHref={timelineHref}
            labels={{
              title: labels.sideTitle,
              close: labels.sideClose,
              openInTimeline: labels.sideOpenInTimeline,
              attempts: labels.sideAttempts,
              correct: labels.sideCorrect,
              lastSeen: labels.sideLastSeen,
              due: labels.sideDue,
              dependsOn: labels.sideDependsOn,
              dependedBy: labels.sideDependedBy,
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Legend({ labels }: { labels: KnowledgeMapProps['labels'] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="hidden gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/80 px-3 py-1.5 text-[10px] text-[var(--color-fg-muted)] backdrop-blur-xl backdrop-saturate-150 md:flex"
    >
      <span className="font-semibold tracking-wider text-[var(--color-fg-subtle)] uppercase">
        {labels.legendTitle}
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block size-3 rounded-full"
          style={{ background: 'var(--color-mastery-4)' }}
        />
        {labels.known}
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block size-3 rounded-full"
          style={{ background: 'var(--color-mastery-2)' }}
        />
        {labels.weak}
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block size-3 rounded-full"
          style={{ background: 'var(--color-mastery-0)' }}
        />
        {labels.unknown}
      </span>
    </motion.div>
  )
}
