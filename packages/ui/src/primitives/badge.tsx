import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]',
        accent: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
        success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
        warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
        danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
        info: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
        outline: 'border border-[var(--color-border)] text-[var(--color-fg-muted)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />
}
