import { type HTMLAttributes } from 'react'
import { cn } from '../cn'

/**
 * Separator — a thin line. Use `orientation="vertical"` for sidebars.
 */
export function Separator({
  className,
  orientation = 'horizontal',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-[var(--color-border)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...rest}
    />
  )
}
