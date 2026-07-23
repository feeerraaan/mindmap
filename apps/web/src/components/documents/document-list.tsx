'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { StatusBadge, type StatusBadgeProps } from '@mindmap/ui'
import { FileText, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { CalmProgress } from '@mindmap/ui'

interface DocumentRow {
  id: string
  filename: string
  status: StatusBadgeProps['status']
  sizeBytes: number
  pageCount: number | null
  createdAt: string
}

interface Labels {
  reading: string
  uploading: string
  parsing: string
  ready: string
}

interface DocumentListProps {
  locale: 'en' | 'es'
  documents: DocumentRow[]
  labels: Labels
}

export function DocumentList({ locale, documents, labels }: DocumentListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {documents.map((d, i) => (
        <DocumentItem
          key={d.id}
          locale={locale}
          doc={d}
          index={i}
          labels={labels}
        />
      ))}
    </ul>
  )
}

function DocumentItem({
  locale,
  doc,
  index,
  labels,
}: {
  locale: 'en' | 'es'
  doc: DocumentRow
  index: number
  labels: Labels
}) {
  // Poll progress while a job is in flight. Once status is terminal
  // (READY/MAPPED/FAILED) the query is disabled — no extra requests.
  const inFlight =
    doc.status === 'QUEUED' || doc.status === 'PARSING' || doc.status === 'GRAPHING' || doc.status === 'DIAGNOSING'

  const { data } = useQuery({
    queryKey: ['doc-status', doc.id],
    enabled: inFlight,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // We don't have a direct doc-status endpoint yet; instead we re-fetch
      // the current page via a soft GET. Cheap, and it works without a new
      // route. Falls back to silent failure if the user is offline.
      const r = await fetch(`/api/documents/${doc.id}/status`, { cache: 'no-store' })
      if (!r.ok) return null
      return (await r.json()) as { status: DocumentRow['status']; progress: number }
    },
    initialData: { status: doc.status, progress: inferProgress(doc.status) },
  })

  const status = data?.status ?? doc.status
  const progress = data?.progress ?? inferProgress(status)

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <FileText size={20} className="shrink-0 text-[var(--color-fg-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-fg)]">{doc.filename}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <StatusBadge status={status} />
          {doc.pageCount ? <span>· {doc.pageCount} pages</span> : null}
          <span>· {(doc.sizeBytes / 1024).toFixed(0)} KB</span>
        </div>
        {inFlight ? (
          <div className="mt-2 max-w-xs">
            <CalmProgress value={progress} size="sm" />
            <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              {statusToLabel(status, labels)}
            </p>
          </div>
        ) : null}
      </div>
      {status === 'READY' || status === 'MAPPED' ? (
        <Link
          href={`/${locale}/mind/${doc.id}` /* placeholder — Map route ships in phase 6 */}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
        >
          Open
          <ArrowRight size={14} />
        </Link>
      ) : null}
    </motion.li>
  )
}

function inferProgress(status: DocumentRow['status']): number {
  switch (status) {
    case 'QUEUED':
      return 0.1
    case 'PARSING':
      return 0.5
    case 'GRAPHING':
      return 0.7
    case 'DIAGNOSING':
      return 0.9
    case 'READY':
    case 'MAPPED':
      return 1
    case 'FAILED':
      return 0
  }
}

function statusToLabel(status: DocumentRow['status'], labels: Labels): string {
  switch (status) {
    case 'QUEUED':
      return labels.uploading
    case 'PARSING':
    case 'GRAPHING':
      return labels.parsing
    case 'DIAGNOSING':
      return labels.reading
    default:
      return ''
  }
}
