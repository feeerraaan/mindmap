'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Input } from '@mindmap/ui'
import { MoreHorizontal, Trash2, Pencil, ArrowRight } from 'lucide-react'
import { deleteMind, renameMind } from '@/features/account/actions'

interface MindListProps {
  locale: 'en' | 'es'
  workspaces: Array<{
    id: string
    name: string
    emoji: string | null
    docCount: number
    updatedAt: string
  }>
  labels: {
    open: string
    rename: string
    delete: string
    untitled: string
    confirmDelete: string
    cancelDelete: string
    deleteTitle: string
    deleteDescription: string
  }
  firstId?: string
}

export function MindList({ locale, workspaces, labels, firstId }: MindListProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }
  function commitEdit() {
    if (!editingId || !editName.trim()) {
      setEditingId(null)
      return
    }
    const id = editingId
    startTransition(async () => {
      try {
        await renameMind({ id, name: editName.trim() })
        setEditingId(null)
        router.refresh()
      } catch {
        setEditingId(null)
      }
    })
  }
  function commitDelete() {
    if (!deletingId) return
    const id = deletingId
    startTransition(async () => {
      try {
        await deleteMind(id)
        setDeletingId(null)
        router.refresh()
      } catch {
        setDeletingId(null)
      }
    })
  }

  if (workspaces.length === 0 && firstId) {
    router.push(`/${locale}/mind/${firstId}`)
    return null
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-2">
        {workspaces.map((ws, i) => (
          <motion.li
            key={ws.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="group flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <span aria-hidden className="text-2xl leading-none">
              {ws.emoji ?? '🧠'}
            </span>
            <div className="min-w-0 flex-1">
              {editingId === ws.id ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={commitEdit}
                  maxLength={60}
                />
              ) : (
                <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                  {ws.name || labels.untitled}
                </p>
              )}
              <p className="text-xs text-[var(--color-fg-subtle)]">
                {ws.docCount} {ws.docCount === 1 ? 'document' : 'documents'}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => startEdit(ws.id, ws.name)}
                aria-label={labels.rename}
                className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(ws.id)}
                aria-label={labels.delete}
                className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-danger)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <Link href={`/${locale}/mind/${ws.id}`}>
              <Button size="sm" variant="ghost">
                <span className="flex items-center gap-1.5">
                  {labels.open}
                  <ArrowRight size={14} />
                </span>
              </Button>
            </Link>
          </motion.li>
        ))}
      </ul>

      {deletingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg">
            <h3 id="del-title" className="text-lg font-semibold text-[var(--color-fg)]">
              {labels.deleteTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {labels.deleteDescription}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeletingId(null)} disabled={pending}>
                {labels.cancelDelete}
              </Button>
              <Button variant="danger" onClick={commitDelete} disabled={pending}>
                {labels.confirmDelete}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only">
        <MoreHorizontal />
      </span>
    </>
  )
}
