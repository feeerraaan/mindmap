import { type Locale as LocaleT } from '@mindmap/types'
import { cn } from '../cn'

/**
 * LocaleSwitch - segmented EN/ES control. Visual only; the parent
 * decides what `onChange` does (cookie, server action, etc).
 */
export interface LocaleSwitchProps {
  value: LocaleT
  onChange?: (next: LocaleT) => void
  className?: string
}

const OPTIONS: Array<{ value: LocaleT; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

export function LocaleSwitch({ value, onChange, className }: LocaleSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Language"
      className={cn(
        'inline-flex items-center rounded-full bg-[var(--color-bg-muted)] p-0.5',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'duration-quick rounded-full px-3 py-1 text-xs transition-all ease-in-out active:scale-95',
              active
                ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'font-normal text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
