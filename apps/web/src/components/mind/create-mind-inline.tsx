'use client'

import { useState, useTransition } from 'react'
import { Button, Input } from '@mindmap/ui'
import { Plus, X } from 'lucide-react'
import { createMind } from '@/features/account/actions'

export function CreateMindInline({
  locale,
  placeholder,
  createLabel,
  examDateLabel,
  examDatePlaceholder,
  examDateHint,
}: {
  locale: 'en' | 'es'
  placeholder: string
  createLabel: string
  examDateLabel: string
  examDatePlaceholder: string
  examDateHint: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) return
    const parsedDate = examDate ? new Date(examDate) : undefined
    if (examDate && Number.isNaN(parsedDate?.getTime() ?? 0)) return
    startTransition(async () => {
      try {
        await createMind({
          name: name.trim(),
          locale,
          examDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
        })
        setName('')
        setExamDate('')
        setOpen(false)
      } catch {
        // redirect on success
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> New
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
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
        <Input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          placeholder={examDatePlaceholder}
          aria-label={examDateLabel}
          className="w-full sm:w-44"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={submit} disabled={pending || !name.trim()}>
            {createLabel}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
            <X size={14} />
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-tight text-[var(--color-fg-subtle)]">{examDateHint}</p>
    </div>
  )
}
