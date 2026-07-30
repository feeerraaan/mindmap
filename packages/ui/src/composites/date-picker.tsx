'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { cn } from '../cn'

export interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  locale?: 'en' | 'es'
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  locale = 'en',
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputId = `date-picker-${Math.random().toString(36).slice(2, 7)}`
  const displayValue = value ? format(value, 'PPP', { locale: locale === 'es' ? es : enUS }) : ''

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        id={inputId}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-11 w-full items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[17px] text-[var(--color-fg)] transition-colors ease-in-out',
          'hover:border-[var(--color-border-strong)]',
          'focus:border-[var(--color-primary-focus)] focus:ring-2 focus:ring-[var(--color-primary-focus)]/30 focus:outline-none',
          displayValue ? '' : 'text-[var(--color-fg-subtle)]',
        )}
      >
        <svg className="mr-2 size-4 shrink-0 text-[var(--color-fg-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
        <span className="truncate text-left">{displayValue || placeholder}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d)
              setOpen(false)
            }}
            locale={locale === 'es' ? es : enUS}
            classNames={{
              root: 'rdp-root',
              months: 'rdp-months',
              month: 'rdp-month',
              month_caption: 'rdp-month-caption flex items-center justify-between px-1 pb-2',
              caption_label: 'rdp-caption-label text-sm font-semibold text-[var(--color-fg)]',
              nav: 'rdp-nav flex items-center gap-1',
              button_previous: 'rdp-button-prev flex size-7 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]',
              button_next: 'rdp-button-next flex size-7 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]',
              chevron: 'rdp-chevron size-4',
              weekdays: 'rdp-weekdays',
              weekday: 'rdp-weekday w-8 pb-1 text-center text-[11px] font-medium text-[var(--color-fg-subtle)]',
              weeks: 'rdp-weeks',
              week: 'rdp-week',
              day: 'rdp-day',
              day_button: 'rdp-day-btn flex size-8 items-center justify-center rounded-md text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-muted)]',
              selected: 'rdp-selected [&_.rdp-day-btn]:bg-[var(--color-primary)] [&_.rdp-day-btn]:text-white [&_.rdp-day-btn]:font-semibold [&_.rdp-day-btn]:rounded-md',
              today: 'rdp-today [&_.rdp-day-btn]:font-semibold',
              outside: 'rdp-outside [&_.rdp-day-btn]:text-[var(--color-fg-subtle)]/40',
              disabled: 'rdp-disabled [&_.rdp-day-btn]:text-[var(--color-fg-subtle)]/30 [&_.rdp-day-btn]:cursor-not-allowed',
              hidden: 'rdp-hidden',
            }}
            components={{
              Chevron: ({ orientation, className }: { orientation?: 'left' | 'right' | 'up' | 'down'; className?: string }) => {
                const d = orientation === 'left'
                  ? 'M15 19l-7-7 7-7'
                  : 'M9 5l7 7-7 7'
                return (
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
                  </svg>
                )
              },
            }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              className="mt-1 w-full rounded-md px-2 py-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
            >
              {locale === 'es' ? 'Limpiar' : 'Clear'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
