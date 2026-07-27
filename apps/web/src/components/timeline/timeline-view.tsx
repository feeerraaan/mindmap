'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Play, History, Clock } from 'lucide-react'
import { Button, MasteryRing, EmptyState } from '@mindmap/ui'
import type { TimelineView, ReviewDay } from '@/features/timeline/actions'

interface TimelineViewProps {
  data: TimelineView
  workspaceId: string
  locale: 'en' | 'es'
  labels: {
    title: string
    subtitle: string
    today: string
    overdue: string
    upcoming: string
    emptyTitle: string
    emptyBody: string
    reasons: Record<
      'decay' | 'new-weakness' | 'dependency-gap' | 'first-review' | 'priority',
      string
    >
    actions: { start: string; resume: string; viewMap: string }
    stats: { todayItems: string; upcomingItems: string }
  }
}

function dayLabel(d: ReviewDay, now: Date): string {
  const sameDay = d.scheduledFor.toDateString() === now.toDateString()
  if (sameDay) return 'Today'
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (d.scheduledFor.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.scheduledFor.toLocaleDateString('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function TimelineViewComponent({ data, workspaceId, locale, labels }: TimelineViewProps) {
  const [now] = useState(() => new Date())
  const hasAny = data.today !== null || data.upcoming.length > 0 || data.overdue.length > 0
  if (!hasAny) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="pb-6">
          <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {labels.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
        </header>
        <EmptyState title={labels.emptyTitle} description={labels.emptyBody} />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
          {labels.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
        <p className="mt-3 text-sm text-[var(--color-fg-subtle)]">
          {labels.stats.todayItems} · {labels.stats.upcomingItems}
        </p>
      </header>

      {data.overdue.length > 0 ? (
        <Section title={labels.overdue} tone="overdue">
          {data.overdue.map((d) => (
            <DayCard
              key={d.key}
              day={d}
              label={dayLabel(d, now)}
              workspaceId={workspaceId}
              locale={locale}
              labels={labels}
              isOverdue
            />
          ))}
        </Section>
      ) : null}

      {data.today ? (
        <Section title={labels.today} tone="today">
          <DayCard
            day={data.today}
            label={labels.today}
            workspaceId={workspaceId}
            locale={locale}
            labels={labels}
            highlight
          />
        </Section>
      ) : null}

      {data.upcoming.length > 0 ? (
        <Section title={labels.upcoming} tone="upcoming">
          {data.upcoming.map((d) => (
            <DayCard
              key={d.key}
              day={d}
              label={dayLabel(d, now)}
              workspaceId={workspaceId}
              locale={locale}
              labels={labels}
            />
          ))}
        </Section>
      ) : null}
    </div>
  )
}

function Section({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'today' | 'overdue' | 'upcoming'
  children: React.ReactNode
}) {
  return (
    <section className="pb-6">
      <h2
        className={
          'pb-2 text-xs font-semibold ' +
          (tone === 'overdue'
            ? 'text-[var(--color-danger)]'
            : tone === 'today'
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-fg-muted)]')
        }
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

void Section

function DayCard({
  day,
  label,
  workspaceId,
  locale,
  labels,
  highlight = false,
  isOverdue = false,
}: {
  day: ReviewDay
  label: string
  workspaceId: string
  locale: 'en' | 'es'
  labels: TimelineViewProps['labels']
  highlight?: boolean
  isOverdue?: boolean
}) {
  const cta =
    day.status === 'STARTED' ? (
      <Link href={`/${locale}/mind/${workspaceId}/review/${day.sessionId ?? ''}`}>
        <Button size="sm">
          <Play size={14} />
          {labels.actions.resume}
        </Button>
      </Link>
    ) : day.sessionId ? (
      <Link href={`/${locale}/mind/${workspaceId}/review/${day.sessionId}`}>
        <Button size="sm" variant={isOverdue ? 'primary' : highlight ? 'primary' : 'secondary'}>
          <Play size={14} />
          {labels.actions.start}
        </Button>
      </Link>
    ) : null
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ' +
        (highlight ? 'ring-1 ring-[var(--color-primary-focus)]/30' : '')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-[var(--color-fg-subtle)]" />
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">{label}</h3>
          <span className="text-xs text-[var(--color-fg-muted)]">· {day.documentName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-fg-subtle)]">
            <Clock size={12} className="mr-1 inline-block" />
            {day.scheduledFor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {cta}
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{day.itemCountLabel}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {day.items.slice(0, 6).map((it) => (
          <li key={it.itemId} className="flex items-center gap-3 text-sm">
            <MasteryRing mastery={it.mastery} confidence={it.confidence} size={28} showLabel />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[var(--color-fg)]">{it.title}</p>
              <p className="truncate text-xs text-[var(--color-fg-subtle)]">
                {labels.reasons[it.reason as keyof typeof labels.reasons] ?? it.reason}
              </p>
            </div>
            <Link
              href={`/${locale}/mind/${workspaceId}/map/${day.documentId}`}
              className="rounded-full p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
              aria-label={labels.actions.viewMap}
            >
              <History size={12} />
            </Link>
          </li>
        ))}
        {day.items.length > 6 ? (
          <li className="text-xs text-[var(--color-fg-subtle)]">+{day.items.length - 6} more</li>
        ) : null}
      </ul>
    </motion.article>
  )
}
