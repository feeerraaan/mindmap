'use client'

import { useState, useTransition } from 'react'
import { Button, Input } from '@mindmap/ui'
import { Plus, X } from 'lucide-react'
import { createMind } from '@/features/account/actions'

export function CreateMindInline({
  locale,
  placeholder,
  createLabel,
}: {
  locale: 'en' | 'es'
  placeholder: string
  createLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) return
    startTransition(async () => {
      try {
        await createMind({ name: name.trim(), locale })
        setName('')
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
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        className="w-48"
        maxLength={60}
      />
      <Button size="sm" onClick={submit} disabled={pending || !name.trim()}>
        {createLabel}
      </Button>
      <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
        <X size={14} />
      </Button>
    </div>
  )
}
