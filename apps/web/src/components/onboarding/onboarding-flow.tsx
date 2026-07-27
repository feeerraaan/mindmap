'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Input } from '@mindmap/ui'
import { completeOnboarding } from '@/features/account/actions'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

type Purpose = 'medicine' | 'law' | 'finance' | 'engineering' | 'language' | 'other'
type Confidence = 'low' | 'mid' | 'high'

interface Labels {
  title: string
  subtitle: string
  step1Title: string
  step1Subtitle: string
  step2Title: string
  step2Subtitle: string
  step3Title: string
  step3Subtitle: string
  medicine: string
  law: string
  finance: string
  engineering: string
  language: string
  other: string
  low: string
  mid: string
  high: string
  placeholder: string
  examDate: string
  examDatePlaceholder: string
  skip: string
  next: string
  back: string
  finish: string
  progress: string
}

const PURPOSE_EMOJI: Record<Purpose, string> = {
  medicine: '🩺',
  law: '⚖️',
  finance: '📈',
  engineering: '🛠️',
  language: '🌐',
  other: '🧠',
}

const PURPOSE_KEYS: Purpose[] = ['medicine', 'law', 'finance', 'engineering', 'language', 'other']
const CONFIDENCE_KEYS: Confidence[] = ['low', 'mid', 'high']

export function OnboardingFlow({ locale, labels }: { locale: 'en' | 'es'; labels: Labels }) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [purpose, setPurpose] = useState<Purpose>('other')
  const [confidence, setConfidence] = useState<Confidence>('mid')
  const [mindName, setMindName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const prefersReduced = usePrefersReducedMotion()

  const direction = step === 0 ? 1 : -1

  function next() {
    setError(null)
    if (step < 2) setStep((s) => (s + 1) as 0 | 1 | 2)
  }
  function back() {
    setError(null)
    if (step > 0) setStep((s) => (s - 1) as 0 | 1 | 2)
  }
  function finish() {
    setError(null)
    startTransition(async () => {
      try {
        await completeOnboarding({
          purpose,
          confidence,
          mindName: mindName || undefined,
          locale,
          examDate: examDate ? new Date(examDate) : undefined,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    })
  }

  const isLast = step === 2
  const progressLabel = labels.progress
    .replace('{current}', String(step + 1))
    .replace('{total}', '3')

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-headline md:text-display font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
          {labels.title}
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
      </header>

      <div
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={progressLabel}
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-subtle)]"
      >
        <motion.div
          className="h-full bg-[var(--color-primary)]"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / 3) * 100}%` }}
          transition={{ duration: prefersReduced ? 0 : 0.35, ease: 'easeInOut' }}
        />
      </div>
      <p className="sr-only">{progressLabel}</p>

      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -direction * 24 }}
            transition={{ duration: prefersReduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {step === 0 && (
              <>
                <header className="flex flex-col gap-1">
                  <h2 className="text-tagline font-semibold text-[var(--color-fg)]">
                    {labels.step1Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step1Subtitle}</p>
                </header>
                <div
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label={labels.step1Title}
                >
                  {PURPOSE_KEYS.map((p) => {
                    const active = purpose === p
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPurpose(p)}
                        className={
                          'flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-all duration-150 ease-in-out active:scale-[0.99] ' +
                          (active
                            ? 'border-2 border-[var(--color-primary-focus)] bg-[var(--color-surface)] text-[var(--color-fg)]'
                            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
                        }
                      >
                        <span aria-hidden className="text-lg">
                          {PURPOSE_EMOJI[p]}
                        </span>
                        <span className="font-medium">{labelFor(p, labels)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <header className="flex flex-col gap-1">
                  <h2 className="text-tagline font-semibold text-[var(--color-fg)]">
                    {labels.step2Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step2Subtitle}</p>
                </header>
                <div
                  className="flex flex-col gap-3"
                  role="radiogroup"
                  aria-label={labels.step2Title}
                >
                  {CONFIDENCE_KEYS.map((c) => {
                    const active = confidence === c
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setConfidence(c)}
                        className={
                          'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150 ease-in-out active:scale-[0.99] ' +
                          (active
                            ? 'border-2 border-[var(--color-primary-focus)] bg-[var(--color-surface)] text-[var(--color-fg)]'
                            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
                        }
                      >
                        <span
                          aria-hidden
                          className={
                            'inline-block size-2 rounded-full ' +
                            (active
                              ? 'bg-[var(--color-primary)]'
                              : 'bg-[var(--color-border-strong)]')
                          }
                        />
                        <span className="font-semibold">{labelFor(c, labels)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <header className="flex flex-col gap-1">
                  <h2 className="text-tagline font-semibold text-[var(--color-fg)]">
                    {labels.step3Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step3Subtitle}</p>
                </header>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {PURPOSE_EMOJI[purpose]}
                    </span>
                    <Input
                      value={mindName}
                      onChange={(e) => setMindName(e.target.value)}
                      placeholder={labels.placeholder}
                      autoFocus
                      maxLength={60}
                      aria-label={labels.step3Title}
                    />
                  </div>
                  <Input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    placeholder={labels.examDatePlaceholder}
                    aria-label={labels.examDate}
                  />
                </div>
                <p className="text-xs text-[var(--color-fg-subtle)]">{labels.skip}</p>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <footer className="flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || pending}>
          {labels.back}
        </Button>
        {isLast ? (
          <Button onClick={finish} disabled={pending}>
            {labels.finish}
          </Button>
        ) : (
          <Button onClick={next} disabled={pending}>
            {labels.next}
          </Button>
        )}
      </footer>
    </div>
  )
}

function labelFor(key: Purpose | Confidence, labels: Labels): string {
  switch (key) {
    case 'medicine':
      return labels.medicine
    case 'law':
      return labels.law
    case 'finance':
      return labels.finance
    case 'engineering':
      return labels.engineering
    case 'language':
      return labels.language
    case 'other':
      return labels.other
    case 'low':
      return labels.low
    case 'mid':
      return labels.mid
    case 'high':
      return labels.high
  }
}
