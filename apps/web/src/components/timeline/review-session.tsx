'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X as XIcon, SkipForward, ArrowRight } from 'lucide-react'
import { Button, MasteryRing, CalmProgress } from '@mindmap/ui'
import type { ActiveReviewView, ReviewItemView } from '@/features/timeline/actions'

interface ReviewSessionClientProps {
  initial: ActiveReviewView
  workspaceId: string
  locale: 'en' | 'es'
  labels: {
    title: string
    subtitle: string
    knew: string
    didnt: string
    skip: string
    next: string
    finish: string
    progressTemplate: string
    completeTitle: string
    completeBody: string
    completeBack: string
  }
}

type Phase = 'asking' | 'submitting' | 'done' | 'error'

/**
 * A short, re-evaluation round: for each `ReviewItem`, the user picks
 * "I knew it" / "I didn't" / "Skip". The result nudges mastery up or
 * down with a small Bayesian-style step and re-schedules the document.
 */
export function ReviewSessionClient({
  initial,
  workspaceId,
  locale,
  labels,
}: ReviewSessionClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<ReviewItemView[]>(initial.items)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('asking')
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<
    Array<{ itemId: string; conceptId: string; result: 'knew' | 'didnt' | 'skip' }>
  >([])

  const current = items[idx]
  const total = items.length

  const submit = useCallback(
    async (result: 'knew' | 'didnt' | 'skip') => {
      if (!current) return
      setPhase('submitting')
      setAnswers((a) => [...a, { itemId: current.itemId, conceptId: current.conceptId, result }])
      // Optimistically adjust the next concept's mastery.
      setItems((prev) => {
        const next = [...prev]
        const local = next[idx]
        if (local) {
          const m = local.mastery
          const c = local.confidence
          if (result === 'knew') {
            local.mastery = Math.min(1, m + 0.12 * (1 - m))
            local.confidence = Math.min(1, c + 0.05)
          } else if (result === 'didnt') {
            local.mastery = Math.max(0, m - 0.12)
            local.confidence = Math.min(1, c + 0.1)
          } else {
            local.confidence = Math.max(0, c - 0.08)
          }
        }
        return next
      })
      if (idx + 1 < total) {
        setIdx(idx + 1)
        setPhase('asking')
        return
      }
      // Final answer: post to the server.
      try {
        const all = [...answers, { itemId: current.itemId, conceptId: current.conceptId, result }]
        const res = await fetch(`/api/timeline/${initial.sessionId}/submit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ answers: all }),
        })
        if (!res.ok) {
          setError('Could not save the review.')
          setPhase('error')
          return
        }
        setPhase('done')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error.')
        setPhase('error')
      }
    },
    [answers, current, idx, initial.sessionId, router, total],
  )

  const progress = useMemo(() => (total === 0 ? 1 : idx / total), [idx, total])

  if (phase === 'done') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Check size={48} className="text-[var(--color-primary)]" />
        </motion.div>
        <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
          {labels.completeTitle}
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{labels.completeBody}</p>
        <Link href={`/${locale}/mind/${workspaceId}/timeline`}>
          <Button>
            {labels.completeBack}
            <ArrowRight size={14} />
          </Button>
        </Link>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">Nothing to review in this session.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
          <span>{initial.documentName}</span>
          <span>
            {labels.progressTemplate
              .replace('{current}', String(idx + 1))
              .replace('{total}', String(total))}
          </span>
        </div>
        <CalmProgress value={progress} size="sm" />
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.itemId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        >
          <div className="flex items-center gap-4">
            <MasteryRing
              mastery={current.mastery}
              confidence={current.confidence}
              size={64}
              showLabel
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--color-fg-muted)]">
                {current.chapter ?? current.topic ?? ''}
              </p>
              <h2 className="text-tagline truncate font-semibold text-[var(--color-fg)]">
                {current.title}
              </h2>
            </div>
          </div>
          <p className="mt-6 text-sm text-[var(--color-fg-muted)]">
            Do you still know this concept well?
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button disabled={phase === 'submitting'} onClick={() => void submit('knew')}>
              <Check size={14} />
              {labels.knew}
            </Button>
            <Button
              variant="secondary"
              disabled={phase === 'submitting'}
              onClick={() => void submit('didnt')}
            >
              <XIcon size={14} />
              {labels.didnt}
            </Button>
            <Button
              variant="ghost"
              disabled={phase === 'submitting'}
              onClick={() => void submit('skip')}
            >
              <SkipForward size={14} />
              {labels.skip}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  )
}
