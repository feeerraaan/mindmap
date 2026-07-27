'use client'

import { motion } from 'framer-motion'
import { MasteryRing } from '@mindmap/ui'
import type { KnowledgeMapData, MapFilter } from './types'

interface ConceptListFallbackProps {
  data: KnowledgeMapData
  filter: MapFilter
  bucketFor: (f: MapFilter, n: KnowledgeMapData['nodes'][number]) => boolean
  onSelect: (id: string) => void
  selectedId: string | null
}

/**
 * Mobile fallback: a vertical list of concepts. Each row shows the
 * concept's mastery ring + title. Tapping a row opens the side panel.
 */
export function ConceptListFallback({
  data,
  filter,
  bucketFor,
  onSelect,
  selectedId,
}: ConceptListFallbackProps) {
  const visible = data.nodes.filter((n) => bucketFor(filter, n))
  return (
    <ul className="mt-4 flex flex-col gap-1.5">
      {visible.map((n) => (
        <motion.li
          key={n.id}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={
              'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border bg-[var(--color-surface)] px-3 py-2.5 text-start text-sm transition-colors ' +
              (selectedId === n.id
                ? 'border-[var(--color-primary-focus)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')
            }
          >
            <MasteryRing mastery={n.mastery} confidence={n.confidence} size={36} showLabel />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[var(--color-fg)]">{n.title}</p>
              {n.chapter ? (
                <p className="truncate text-xs text-[var(--color-fg-subtle)]">{n.chapter}</p>
              ) : null}
            </div>
          </button>
        </motion.li>
      ))}
    </ul>
  )
}
