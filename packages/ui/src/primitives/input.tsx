import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'duration-quick flex h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[17px] text-[var(--color-fg)] transition-colors ease-in-out',
          'placeholder:text-[var(--color-fg-subtle)]',
          'focus:border-[var(--color-primary-focus)] focus:ring-2 focus:ring-[var(--color-primary-focus)]/30 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-normal',
          className,
        )}
        {...rest}
      />
    )
  },
)
