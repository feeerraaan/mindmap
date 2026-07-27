'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@mindmap/ui'
import { Send } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

interface ClarificationCardProps {
  text: string
  microFeedback: string
  onSubmit: (text: string) => void
  disabled: boolean
  labels: {
    title: string
    placeholder: string
    submit: string
  }
}

export function ClarificationCard({
  text,
  microFeedback,
  onSubmit,
  disabled,
  labels,
}: ClarificationCardProps) {
  const [reply, setReply] = useState('')
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const prefersReduced = usePrefersReducedMotion()

  useEffect(() => {
    taRef.current?.focus()
  }, [])

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      role="region"
      aria-label={labels.title}
    >
      <div>
        <p className="text-xs font-semibold text-[var(--color-fg-muted)]">{labels.title}</p>
        <p
          className="mt-1 text-[17px] leading-relaxed text-[var(--color-fg)]"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence>
            <motion.span
              key={text}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReduced ? 0 : 0.18 }}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
      <textarea
        ref={taRef}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder={labels.placeholder}
        aria-label={labels.title}
        className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[17px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-primary-focus)] focus:ring-2 focus:ring-[var(--color-primary-focus)]/30 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <Button
          disabled={disabled || reply.trim().length === 0}
          onClick={() => onSubmit(reply.trim())}
          size="sm"
        >
          <Send size={14} />
          {labels.submit}
        </Button>
        {microFeedback ? (
          <span className="text-xs text-[var(--color-fg-muted)]" role="status">
            {microFeedback}
          </span>
        ) : null}
      </div>
    </motion.div>
  )
}
