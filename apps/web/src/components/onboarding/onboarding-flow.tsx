'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Input } from '@mindmap/ui'
import { completeOnboarding } from '@/features/account/actions'

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
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const direction = step === 0 ? 1 : -1

  function next() {
    setError(null)
    if (step < 2) setStep((s) => ((s + 1) as 0 | 1 | 2))
  }
  function back() {
    setError(null)
    if (step > 0) setStep((s) => ((s - 1) as 0 | 1 | 2))
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
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    })
  }

  const isLast = step === 2

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)] md:text-3xl">
          {labels.title}
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{labels.subtitle}</p>
      </header>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]"
        aria-label={labels.progress.replace('{current}', String(step + 1)).replace('{total}', '3')}
      >
        <motion.div
          className="h-full bg-[var(--color-accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / 3) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 24 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {step === 0 && (
              <>
                <header className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-[var(--color-fg)]">
                    {labels.step1Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step1Subtitle}</p>
                </header>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PURPOSE_KEYS.map((p) => {
                    const active = purpose === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPurpose(p)}
                        className={
                          'flex items-center gap-2 rounded-md border px-3 py-3 text-left text-sm transition-colors ' +
                          (active
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-fg)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
                        }
                        aria-pressed={active}
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
                  <h2 className="text-lg font-semibold text-[var(--color-fg)]">
                    {labels.step2Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step2Subtitle}</p>
                </header>
                <div className="flex flex-col gap-2">
                  {CONFIDENCE_KEYS.map((c) => {
                    const active = confidence === c
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setConfidence(c)}
                        className={
                          'flex items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors ' +
                          (active
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 text-[var(--color-fg)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]')
                        }
                        aria-pressed={active}
                      >
                        <span
                          aria-hidden
                          className={
                            'inline-block size-2 rounded-full ' +
                            (active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')
                          }
                        />
                        <span className="font-medium">{labelFor(c, labels)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <header className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-[var(--color-fg)]">
                    {labels.step3Title}
                  </h2>
                  <p className="text-sm text-[var(--color-fg-muted)]">{labels.step3Subtitle}</p>
                </header>
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
                  />
                </div>
                <p className="text-xs text-[var(--color-fg-subtle)]">{labels.skip}</p>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
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
