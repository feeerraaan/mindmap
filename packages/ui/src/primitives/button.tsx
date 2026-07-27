import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal transition-all duration-quick ease-in-out active:scale-95 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:
          'rounded-full bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]',
        secondary:
          'rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5',
        ghost: 'rounded-full text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)]',
        outline:
          'rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)]',
        danger: 'rounded-full bg-[var(--color-danger)] text-white hover:opacity-90',
        link: 'text-[var(--color-primary)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-4 text-sm',
        md: 'h-11 px-[22px] text-[17px]',
        lg: 'h-12 px-7 text-lg font-light',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  )
})

export { buttonVariants }
