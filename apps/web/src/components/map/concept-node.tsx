'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@mindmap/ui'

export interface ConceptNodeData {
  title: string
  mastery: number
  confidence: number
  attempts: number
  importance: number
  isSelected?: boolean
  isDimmed?: boolean
  [key: string]: unknown
}

const RAMP = [
  'var(--color-mastery-0)',
  'var(--color-mastery-1)',
  'var(--color-mastery-2)',
  'var(--color-mastery-3)',
  'var(--color-mastery-4)',
]

function colorForMastery(m: number): string {
  if (m < 0.2) return RAMP[0]!
  if (m < 0.4) return RAMP[1]!
  if (m < 0.6) return RAMP[2]!
  if (m < 0.8) return RAMP[3]!
  return RAMP[4]!
}

/**
 * Custom node for the knowledge map. Color = mastery, opacity =
 * confidence. Selected = ring; dimmed = low opacity.
 */
function ConceptNodeImpl({ data, selected }: NodeProps) {
  const d = data as ConceptNodeData
  const opacity = 0.4 + d.confidence * 0.6
  const color = colorForMastery(d.mastery)
  const size = 24 + d.importance * 36
  const labelLight = d.mastery < 0.4
  return (
    <div
      className={cn(
        'group relative flex items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] transition-all',
        selected && 'ring-2 ring-[var(--color-primary-focus)]',
        d.isDimmed && 'opacity-20',
      )}
      style={{ width: size, height: size, opacity: d.isDimmed ? 0.2 : opacity }}
    >
      <span
        aria-hidden
        className="absolute inset-1 rounded-full"
        style={{ background: color, opacity: 0.9 }}
      />
      <span
        className={cn(
          'relative z-10 max-w-[80%] truncate px-1 text-center text-[10px] font-semibold',
          labelLight ? 'text-[var(--color-fg)]' : 'text-white',
        )}
      >
        {d.title}
      </span>
      {d.attempts === 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full border border-[var(--color-bg)] bg-[var(--color-fg-subtle)]"
        />
      ) : null}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

export const ConceptNode = memo(ConceptNodeImpl)
