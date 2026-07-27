'use client'

import { motion } from 'framer-motion'
import { CalmProgress } from '@mindmap/ui'
import { Sparkles } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

interface CalmThinkingProps {
  label: string
}

export function CalmThinking({ label }: CalmThinkingProps) {
  const prefersReduced = usePrefersReducedMotion()

  return (
    <div
      className="flex flex-col items-center gap-4 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <motion.div
        aria-hidden
        initial={{ scale: 1, opacity: 0.8 }}
        animate={prefersReduced ? { opacity: 1 } : { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={
          prefersReduced ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
        }
        className="text-[var(--color-primary)]"
      >
        <Sparkles size={28} />
      </motion.div>
      <p className="text-sm text-[var(--color-fg-muted)]">{label}</p>
      <div className="w-48">
        <CalmProgress value={0.5} size="sm" />
      </div>
    </div>
  )
}
