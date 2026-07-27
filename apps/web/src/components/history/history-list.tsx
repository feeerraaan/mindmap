'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { EmptyState, MasteryRing } from '@mindmap/ui'
import type { HistoryView } from '@/features/timeline/actions'

interface HistoryListProps {
  data: HistoryView
  workspaceId: string
  locale: 'en' | 'es'
  labels: {
    title: string
    subtitle: string
    diagnosis: string
    review: string
    confidence: string
    noDelta: string
    emptyTitle: string
    emptyBody: string
    viewMap: string
  }
}

export function HistoryList({ data, workspaceId, locale, labels }: HistoryListProps) {
  if (data.entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="pb-6">
          <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {labels.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
        </header>
        <EmptyState title={labels.emptyTitle} description={labels.emptyBody} />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
          {labels.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
        {data.totalEntries > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-fg-subtle)]">
            <MasteryRing mastery={data.globalConfidence} confidence={0.8} size={24} showLabel />
            Global average: {Math.round(data.globalConfidence * 100)}%
          </div>
        ) : null}
      </header>

      <ul className="flex flex-col gap-2">
        {data.entries.map((e) => {
          const Icon = e.kind === 'diagnosis' ? Brain : Calendar
          const when = (e.finishedAt ?? e.startedAt).toLocaleString(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
          const deltaNode =
            e.delta === null ? (
              <span className="flex items-center gap-1 text-xs text-[var(--color-fg-subtle)]">
                <Minus size={12} /> {labels.noDelta}
              </span>
            ) : e.delta >= 0 ? (
              <span className="flex items-center gap-1 text-xs text-[var(--color-mastery-4)]">
                <TrendingUp size={12} /> {e.deltaLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-[var(--color-mastery-0)]">
                <TrendingDown size={12} /> {e.deltaLabel}
              </span>
            )
          return (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]"
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/mind/${workspaceId}/map/${e.documentId}`}
                      className="truncate text-sm font-semibold text-[var(--color-fg)] hover:underline"
                    >
                      {e.documentName}
                    </Link>
                    <p className="text-xs text-[var(--color-fg-subtle)]">
                      {e.kind === 'diagnosis' ? labels.diagnosis : labels.review} · {when}
                    </p>
                  </div>
                </div>
                <div className="text-end">
                  {e.kind === 'diagnosis' ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--color-fg)]">
                        {Math.round(e.finalConfidence * 100)}%
                      </p>
                      <p className="text-xs text-[var(--color-fg-subtle)]">{labels.confidence}</p>
                      {deltaNode}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-[var(--color-fg)]">
                        {e.questionsLabel}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
