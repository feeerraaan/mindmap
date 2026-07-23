import { type LabelHTMLAttributes, forwardRef } from 'react'
import { cn } from '../cn'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...rest }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none text-[var(--color-fg)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className,
        )}
        {...rest}
      />
    )
  },
)
