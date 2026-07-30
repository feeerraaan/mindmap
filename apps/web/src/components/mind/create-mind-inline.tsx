'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Input, DatePicker } from '@mindmap/ui'
import { Plus, X } from 'lucide-react'
import { createMind } from '@/features/account/actions'

export function CreateMindInline({
  locale,
  placeholder,
  createLabel,
  examDatePlaceholder,
  examDateHint,
}: {
  locale: 'en' | 'es'
  placeholder: string
  createLabel: string
  examDatePlaceholder: string
  examDateHint: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState<Date | undefined>(undefined)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) return
    startTransition(async () => {
      try {
        await createMind({
          name: name.trim(),
          locale,
          examDate: examDate ?? undefined,
        })
        setName('')
        setExamDate(undefined)
        setOpen(false)
      } catch {
        // redirect on success
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div
            key="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> New
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.98, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.98, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                  if (e.key === 'Escape') setOpen(false)
                }}
                placeholder={placeholder}
                className="w-full sm:w-48"
                maxLength={60}
              />
              <div className="relative w-full sm:w-44">
                <DatePicker
                  value={examDate}
                  onChange={setExamDate}
                  placeholder={examDatePlaceholder}
                  locale={locale}
                />
                <p className="absolute top-full left-0 mt-0.5 text-[11px] leading-tight text-[var(--color-fg-subtle)] whitespace-nowrap">{examDateHint}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={submit} disabled={pending || !name.trim()}>
                  {createLabel}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
                  <X size={14} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
