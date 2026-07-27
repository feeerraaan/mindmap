'use client'

import type { MapFilter } from './types'

interface MapFiltersProps {
  current: MapFilter
  counts: Record<MapFilter, number>
  labels: Record<MapFilter, string>
  onChange: (f: MapFilter) => void
}

const ORDER: MapFilter[] = ['all', 'known', 'thinkIKnow', 'dontKnow', 'aboutToForget']

/**
 * Filter chips for the knowledge map. Calm segmented control; the
 * selected one is filled.
 */
export function MapFilters({ current, counts, labels, onChange }: MapFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter concepts"
      className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-1 text-xs backdrop-blur-xl backdrop-saturate-150"
    >
      {ORDER.map((f) => {
        const active = current === f
        return (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f)}
            className={
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all duration-150 ease-in-out active:scale-95 ' +
              (active
                ? 'border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-semibold text-[var(--color-fg)]'
                : 'font-normal text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]')
            }
          >
            <span>{labels[f]}</span>
            <span
              className={
                'inline-flex min-w-5 justify-center rounded-full px-1 text-[10px] tabular-nums ' +
                (active ? 'bg-[var(--color-bg-muted)]' : 'bg-transparent')
              }
            >
              {counts[f]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
