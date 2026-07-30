'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar } from 'lucide-react'
import { Button } from '@mindmap/ui'
import type { KnowledgeMapData, KnowledgeMapNode } from './types'

interface ConceptSidePanelProps {
  data: KnowledgeMapData
  selectedId: string | null
  onClose: () => void
  timelineHref: string
  labels: {
    title: string
    close: string
    openInTimeline: string
    attempts: string
    correct: string
    lastSeen: string
    due: string
    dependsOn: string
    dependedBy: string
  }
}

function formatRelative(iso: string | null, fallback: string): string {
  if (!iso) return fallback
  const d = new Date(iso)
  const diffDays = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays === -1) return 'yesterday'
  if (diffDays > 0) return `in ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}

/**
 * Side panel that opens when a node is selected. Renders the node's
 * full state, dependency neighborhood, and a "open in timeline" CTA.
 */
export function ConceptSidePanel({
  data,
  selectedId,
  onClose,
  timelineHref,
  labels,
}: ConceptSidePanelProps) {
  const node = useMemo<KnowledgeMapNode | null>(
    () => (selectedId ? (data.nodes.find((n) => n.id === selectedId) ?? null) : null),
    [data, selectedId],
  )
  const dependsOn = useMemo<KnowledgeMapNode[]>(() => {
    if (!node) return []
    const incoming = data.edges.filter((e) => e.target === node.id)
    return incoming
      .map((e) => data.nodes.find((n) => n.id === e.source))
      .filter((n): n is KnowledgeMapNode => n !== undefined)
  }, [data, node])
  const dependedBy = useMemo<KnowledgeMapNode[]>(() => {
    if (!node) return []
    const outgoing = data.edges.filter((e) => e.source === node.id)
    return outgoing
      .map((e) => data.nodes.find((n) => n.id === e.target))
      .filter((n): n is KnowledgeMapNode => n !== undefined)
  }, [data, node])
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (node) setVisible(true)
    else setVisible(false)
  }, [node])

  if (!node) return null
  return (
    <motion.aside
      key={node.id}
      initial={{ x: 16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 16, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 right-0 z-10 h-full w-80 max-w-full overflow-y-auto rounded-l-[var(--radius-lg)] border-l border-[var(--color-border)] bg-[var(--color-surface)]/95 p-5 backdrop-blur-xl backdrop-saturate-150"
      role="complementary"
      aria-label={labels.title}
      data-visible={visible}
    >
      <div className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--color-fg-muted)]">{labels.title}</p>
          <h3 className="text-tagline truncate font-semibold text-[var(--color-fg)]">
            {node.title}
          </h3>
          {node.chapter ? (
            <p className="truncate text-xs text-[var(--color-fg-muted)]">{node.chapter}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="rounded-full p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 pb-5">
        <Stat label="Mastery" value={`${Math.round(node.mastery * 100)}%`} />
        <Stat label="Confidence" value={`${Math.round(node.confidence * 100)}%`} />
        <Stat label={labels.attempts} value={String(node.attempts)} />
        <Stat label={labels.correct} value={String(node.correct)} />
        <Stat label={labels.lastSeen} value={formatRelative(node.lastSeen, '-')} />
        <Stat label={labels.due} value={formatRelative(node.dueAt, '-')} />
      </dl>

      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{node.summary}</p>

      {dependsOn.length > 0 ? (
        <section className="mt-4 border-t border-[var(--color-border-subtle)] pt-3">
          <p className="pb-1 text-xs font-semibold text-[var(--color-fg-muted)]">
            {labels.dependsOn}
          </p>
          <ul className="space-y-1.5 text-sm">
            {dependsOn.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-[var(--color-fg)]">{d.title}</span>
                <span className="shrink-0 ps-2 text-xs text-[var(--color-fg-subtle)]">
                  {Math.round(d.mastery * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dependedBy.length > 0 ? (
        <section className="mt-4 border-t border-[var(--color-border-subtle)] pt-3">
          <p className="pb-1 text-xs font-semibold text-[var(--color-fg-muted)]">
            {labels.dependedBy}
          </p>
          <ul className="space-y-1.5 text-sm">
            {dependedBy.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-bg)] px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-[var(--color-fg)]">{d.title}</span>
                <span className="shrink-0 ps-2 text-xs text-[var(--color-fg-subtle)]">
                  {Math.round(d.mastery * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 flex">
        <Link href={timelineHref}>
          <Button variant="secondary" size="sm">
            <Calendar size={14} />
            {labels.openInTimeline}
          </Button>
        </Link>
      </div>
    </motion.aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <dt className="text-[10px] font-semibold text-[var(--color-fg-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-[var(--color-fg)]">{value}</dd>
    </div>
  )
}
