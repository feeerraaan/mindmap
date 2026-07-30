import { type HTMLAttributes } from 'react'
import { cn } from '../cn'

/**
 * Skeleton - a calm placeholder for loading content.
 * Uses a soft gradient pulse rather than a harsh shimmer.
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-[var(--color-bg-muted)]',
        'after:absolute after:inset-0 after:translate-x-[-100%] after:animate-[shimmer_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-black/5 after:to-transparent dark:after:via-white/10',
        className,
      )}
      {...rest}
    />
  )
}
