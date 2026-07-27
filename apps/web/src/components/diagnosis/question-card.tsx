'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { DiagnosisQuestion } from '@mindmap/brain'
import { Button } from '@mindmap/ui'
import { useState } from 'react'
import { Check, HelpCircle, SkipForward, Lightbulb } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

interface QuestionCardProps {
  question: DiagnosisQuestion
  microFeedback: string
  onSubmit: (
    answer:
      | { kind: 'MCQ'; optionIndex: number }
      | { kind: 'OPEN'; text: string }
      | { kind: 'IDONTKNOW' }
      | { kind: 'SKIP' },
  ) => void
  disabled: boolean
  labels: {
    iDontKnow: string
    skip: string
    submit: string
    openPlaceholder: string
  }
}

export function QuestionCard({
  question,
  microFeedback,
  onSubmit,
  disabled,
  labels,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [text, setText] = useState('')
  const prefersReduced = usePrefersReducedMotion()

  if (question.kind === 'EASY') {
    return (
      <div className="space-y-6">
        <p className="text-lg leading-relaxed text-[var(--color-fg)]">{question.prompt}</p>
        <fieldset disabled={disabled}>
          <legend className="sr-only">{question.prompt}</legend>
          <ul className="space-y-2" role="radiogroup">
            {question.options.map((opt, i) => {
              const active = selected === i
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(i)}
                    className={
                      'group flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-start text-sm transition-all duration-150 ease-in-out active:scale-[0.99] ' +
                      (active
                        ? 'border-2 border-[var(--color-primary-focus)] bg-[var(--color-surface)] text-[var(--color-fg)]'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)]')
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ' +
                        (active
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border-strong)] text-[var(--color-fg-muted)]')
                      }
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={disabled || selected === null}
            onClick={() => selected !== null && onSubmit({ kind: 'MCQ', optionIndex: selected })}
          >
            <Check size={14} />
            {labels.submit}
          </Button>
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => onSubmit({ kind: 'IDONTKNOW' })}
          >
            <HelpCircle size={14} />
            {labels.iDontKnow}
          </Button>
          <Button variant="ghost" disabled={disabled} onClick={() => onSubmit({ kind: 'SKIP' })}>
            <SkipForward size={14} />
            {labels.skip}
          </Button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <AnimatePresence>
            {microFeedback ? (
              <motion.p
                key={microFeedback}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-[var(--color-fg-muted)]"
              >
                {microFeedback}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-lg leading-relaxed text-[var(--color-fg)]">{question.prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder={labels.openPlaceholder}
        aria-label={question.prompt}
        className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[17px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-primary-focus)] focus:ring-2 focus:ring-[var(--color-primary-focus)]/30 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || text.trim().length === 0}
          onClick={() => onSubmit({ kind: 'OPEN', text: text.trim() })}
        >
          <Check size={14} />
          {labels.submit}
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => onSubmit({ kind: 'IDONTKNOW' })}>
          <Lightbulb size={14} />
          {labels.iDontKnow}
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => onSubmit({ kind: 'SKIP' })}>
          <SkipForward size={14} />
          {labels.skip}
        </Button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {microFeedback ? (
            <motion.p
              key={microFeedback}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-[var(--color-fg-muted)]"
            >
              {microFeedback}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
