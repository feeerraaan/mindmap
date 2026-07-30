import { type ReactNode } from 'react'
import { cn } from '../cn'

/**
 * MindHeader - the page header for a Workspace ("Mind").
 *
 * Shows the workspace name + optional emoji and slots for actions on the right.
 */
export interface MindHeaderProps {
  name: string
  emoji?: string | null
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function MindHeader({ name, emoji, subtitle, actions, className }: MindHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)] px-6 py-6 md:flex-row md:items-center md:justify-between md:px-8',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {emoji ? (
          <span aria-hidden className="text-2xl leading-none">
            {emoji}
          </span>
        ) : null}
        <div className="flex flex-col">
          <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {name}
          </h1>
          {subtitle ? <p className="text-sm text-[var(--color-fg-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
