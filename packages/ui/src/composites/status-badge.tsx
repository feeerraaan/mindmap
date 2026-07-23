import { Badge } from '../primitives/badge'
import type { DocumentStatus } from '@mindmap/types'

const labels: Record<DocumentStatus, string> = {
  QUEUED: 'Queued',
  PARSING: 'Reading',
  GRAPHING: 'Mapping',
  READY: 'Ready',
  DIAGNOSING: 'Diagnosing',
  MAPPED: 'Mapped',
  FAILED: 'Needs attention',
}

const tones: Record<
  DocumentStatus,
  'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger'
> = {
  QUEUED: 'neutral',
  PARSING: 'info',
  GRAPHING: 'accent',
  READY: 'accent',
  DIAGNOSING: 'accent',
  MAPPED: 'success',
  FAILED: 'danger',
}

export type StatusBadgeProps = { status: DocumentStatus }

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge tone={tones[status]} aria-label={`Status: ${labels[status]}`}>
      <span className="inline-block size-1.5 rounded-full bg-current" aria-hidden />
      {labels[status]}
    </Badge>
  )
}
