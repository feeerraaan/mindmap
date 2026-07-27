'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { StatusBadge, type StatusBadgeProps, Button } from '@mindmap/ui'
import { FileText, ArrowRight, Network, Brain, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTransition } from 'react'
import { CalmProgress } from '@mindmap/ui'
import { deleteDocument } from '@/features/documents/actions'

interface DocumentRow {
  id: string
  filename: string
  status: StatusBadgeProps['status']
  sizeBytes: number
  pageCount: number | null
  createdAt: string
  conceptCount: number | null
  conceptsLabel: string | null
}

interface Labels {
  reading: string
  uploading: string
  parsing: string
  ready: string
  graphing: string
  open: string
  diagnose: string
  continueDiagnosis: string
}

interface DocumentListProps {
  locale: 'en' | 'es'
  workspaceId: string
  documents: DocumentRow[]
  labels: Labels
}

export function DocumentList({ locale, workspaceId, documents, labels }: DocumentListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {documents.map((d, i) => (
        <DocumentItem
          key={d.id}
          locale={locale}
          workspaceId={workspaceId}
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
  workspaceId,
  doc,
  index,
  labels,
}: {
  locale: 'en' | 'es'
  workspaceId: string
  doc: DocumentRow
  index: number
  labels: Labels
}) {
  const inFlight =
    doc.status === 'QUEUED' ||
    doc.status === 'PARSING' ||
    doc.status === 'GRAPHING' ||
    doc.status === 'DIAGNOSING'

  const { data } = useQuery({
    queryKey: ['doc-status', doc.id],
    enabled: inFlight || doc.conceptCount === null,
    refetchInterval: (q) => {
      const status = (q.state.data as { status?: DocumentRow['status'] } | undefined)?.status
      return status === 'READY' || status === 'MAPPED' || status === 'FAILED' ? false : 2000
    },
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const r = await fetch(`/api/documents/${doc.id}/status`, { cache: 'no-store' })
      if (!r.ok) return null
      return (await r.json()) as {
        status: DocumentRow['status']
        progress: number
        conceptCount?: number
      }
    },
    initialData: {
      status: doc.status,
      progress: inferProgress(doc.status),
      ...(doc.conceptCount !== null ? { conceptCount: doc.conceptCount } : {}),
    },
  })

  const status = data?.status ?? doc.status
  const progress = data?.progress ?? inferProgress(status)
  const conceptCount = data?.conceptCount ?? doc.conceptCount
  const canDiagnose = status === 'READY' || status === 'DIAGNOSING' || status === 'MAPPED'
  const continueDiagnosis = status === 'DIAGNOSING'
  const [isDeleting, startDelete] = useTransition()

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: 'easeInOut' }}
      className="group flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <FileText size={20} className="shrink-0 text-[var(--color-fg-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{doc.filename}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-fg-muted)]">
          <StatusBadge status={status} />
          {doc.pageCount ? <span>· {doc.pageCount} pages</span> : null}
          <span>· {(doc.sizeBytes / 1024).toFixed(0)} KB</span>
          {conceptCount !== null && conceptCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[var(--color-fg)]">
              <Network size={12} aria-hidden />
              {doc.conceptsLabel}
            </span>
          ) : null}
        </div>
        {inFlight ? (
          <div className="mt-2 max-w-xs">
            <CalmProgress value={progress} size="sm" />
            <p className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
              {statusToLabel(status, labels)}
            </p>
          </div>
        ) : null}
        {status === 'FAILED' ? (
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            {doc.conceptCount === 0 ? doc.conceptsLabel : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canDiagnose ? (
          <Link href={`/${locale}/mind/${workspaceId}/diagnose/${doc.id}`}>
            <Button size="sm" variant={continueDiagnosis ? 'primary' : 'secondary'}>
              <Brain size={14} />
              {continueDiagnosis ? labels.continueDiagnosis : labels.diagnose}
              <ArrowRight size={14} />
            </Button>
          </Link>
        ) : null}
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => {
            if (confirm('Delete this document?')) startDelete(() => deleteDocument(doc.id))
          }}
          className="flex size-8 items-center justify-center rounded-full text-[var(--color-fg-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)] focus:opacity-100"
          aria-label="Delete document"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
      return labels.parsing
    case 'GRAPHING':
      return labels.graphing
    case 'DIAGNOSING':
      return labels.reading
    default:
      return ''
  }
}
