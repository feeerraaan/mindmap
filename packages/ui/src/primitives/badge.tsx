import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]',
        accent: 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]',
        success: 'bg-[var(--color-success)] text-white',
        warning: 'bg-[var(--color-warning)] text-white',
        danger: 'bg-[var(--color-danger)] text-white',
        info: 'bg-[var(--color-info)] text-white',
        outline: 'border border-[var(--color-border)] text-[var(--color-fg-muted)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />
}
