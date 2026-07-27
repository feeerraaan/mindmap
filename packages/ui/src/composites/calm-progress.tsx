import { type HTMLAttributes } from 'react'
import { cn } from '../cn'

/**
 * CalmProgress — a thin progress line. No percentage by default; we hide
 * numbers in the calm mode and let the line breathe.
 *
 * Pass `value` ∈ [0,1]. Pass `showLabel` to render a small tabular number.
 */
export interface CalmProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function CalmProgress({
  value,
  showLabel = false,
  size = 'sm',
  className,
  ...rest
}: CalmProgressProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const pct = Math.round(clamped * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('flex w-full items-center gap-3', className)}
      {...rest}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]',
          size === 'sm' ? 'h-1' : 'h-1.5',
        )}
      >
        <div
          className="duration-base h-full rounded-full bg-[var(--color-primary)] transition-[width] ease-in-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span
          className="min-w-[3ch] text-right text-xs text-[var(--color-fg-muted)] tabular-nums"
          data-num
        >
          {pct}%
        </span>
      ) : null}
    </div>
  )
}
