import { type ReactNode } from 'react'
import { cn } from '../cn'

/**
 * EmptyState - calm, single-affordance empty surfaces.
 *
 * - A small geometric mark in --color-fg-subtle.
 * - One sentence describing what *will* be here.
 * - One primary action.
 * - No sad faces. No illustrations of emptiness.
 */
export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-16 text-center',
        className,
      )}
    >
      <div
        aria-hidden
        className="size-10 rounded-md border border-[var(--color-border-strong)]"
        style={{
          backgroundImage:
            'linear-gradient(135deg, transparent 49%, var(--color-border-strong) 49% 51%, transparent 51%)',
        }}
      />
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="text-[17px] font-semibold text-[var(--color-fg)]">{title}</p>
        {description ? (
          <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  )
}
