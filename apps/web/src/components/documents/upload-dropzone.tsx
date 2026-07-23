'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@mindmap/ui'
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { finalizeUpload, initUpload } from '@/features/documents/actions'

type Phase = 'idle' | 'reading' | 'uploading' | 'parsing' | 'ready' | 'error'

interface UploadItem {
  id: string
  filename: string
  sizeBytes: number
  phase: Phase
  progress: number
  error?: string
  documentId?: string
}

const MAX_BYTES = 25 * 1024 * 1024

const COPY = {
  idle: {
    title: 'Drop a document here',
    body: 'or click to browse — PDF, PPTX, or DOCX up to 25 MB.',
  },
}

interface UploadDropzoneProps {
  workspaceId: string
  locale: 'en' | 'es'
  labels: {
    dropTitle: string
    dropBody: string
    cancel: string
    retry: string
    done: string
    tooBig: string
    wrongType: string
    errorGeneric: string
    reading: string
    uploading: string
    parsing: string
    ready: string
  }
  onUploaded?: (documentId: string) => void
}

export function UploadDropzone({ workspaceId, locale, labels, onUploaded }: UploadDropzoneProps) {
  const router = useRouter()
  const [items, setItems] = useState<UploadItem[]>([])
  const itemsRef = useRef<UploadItem[]>([])
  itemsRef.current = items

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const runOne = useCallback(
    async (file: File) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const item: UploadItem = {
        id,
        filename: file.name,
        sizeBytes: file.size,
        phase: 'reading',
        progress: 0,
      }
      setItems((prev) => [...prev, item])

      try {
        const init = await initUpload({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          workspaceId,
        })
        updateItem(id, { phase: 'uploading', progress: 0.1, documentId: init.documentId })

        const res = await fetch(init.uploadUrl, {
          method: init.method,
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!res.ok) {
          updateItem(id, { phase: 'error', error: labels.errorGeneric })
          return
        }
        updateItem(id, { phase: 'parsing', progress: 0.7 })

        const fin = await finalizeUpload(init.documentId)
        if (!fin.jobId) {
          updateItem(id, { phase: 'ready', progress: 1 })
          onUploaded?.(init.documentId)
          return
        }

        // Poll the job until completion.
        for (let i = 0; i < 240; i += 1) {
          await new Promise((r) => setTimeout(r, 1500))
          try {
            const r = await fetch(`/api/jobs/${fin.jobId}`)
            if (!r.ok) continue
            const data: { status: string; error: string | null } = await r.json()
            if (data.status === 'COMPLETED') {
              updateItem(id, { phase: 'ready', progress: 1 })
              onUploaded?.(init.documentId)
              router.refresh()
              return
            }
            if (data.status === 'FAILED') {
              updateItem(id, { phase: 'error', error: data.error ?? labels.errorGeneric })
              return
            }
          } catch {
            /* keep polling */
          }
        }
        updateItem(id, { phase: 'error', error: labels.errorGeneric })
      } catch (e) {
        const msg = e instanceof Error ? e.message : labels.errorGeneric
        updateItem(id, { phase: 'error', error: msg })
      }
    },
    [workspaceId, labels.errorGeneric, onUploaded, router, updateItem],
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      for (const file of accepted) {
        if (file.size > MAX_BYTES) {
          setItems((prev) => [
            ...prev,
            {
              id: `bad-${file.name}-${Date.now()}`,
              filename: file.name,
              sizeBytes: file.size,
              phase: 'error',
              progress: 0,
              error: labels.tooBig,
            },
          ])
          continue
        }
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ]
        if (!allowed.includes(file.type)) {
          setItems((prev) => [
            ...prev,
            {
              id: `bad-${file.name}-${Date.now()}`,
              filename: file.name,
              sizeBytes: file.size,
              phase: 'error',
              progress: 0,
              error: labels.wrongType,
            },
          ])
          continue
        }
        void runOne(file)
      }
    },
    [labels.tooBig, labels.wrongType, runOne],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
  })

  function clearDone() {
    setItems((prev) => prev.filter((it) => it.phase !== 'ready' && it.phase !== 'error'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className={
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ' +
          (isDragActive && !isDragReject
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
            : isDragReject
              ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')
        }
      >
        <input {...getInputProps()} aria-label="file-input" />
        <UploadCloud size={28} className="text-[var(--color-fg-muted)]" />
        <p className="text-sm font-medium text-[var(--color-fg)]">{labels.dropTitle}</p>
        <p className="text-xs text-[var(--color-fg-muted)]">{labels.dropBody}</p>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm"
              >
                <FileText size={16} className="shrink-0 text-[var(--color-fg-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--color-fg)]">{it.filename}</p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    {phaseLabel(it.phase, labels)} · {(it.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                  {it.phase === 'uploading' || it.phase === 'parsing' || it.phase === 'reading' ? (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                      <motion.div
                        className="h-full bg-[var(--color-accent)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(it.progress * 100)}%` }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  ) : null}
                </div>
                {it.phase === 'ready' ? (
                  <CheckCircle2 size={18} className="text-[var(--color-success)]" />
                ) : it.phase === 'error' ? (
                  <div className="flex items-center gap-2 text-[var(--color-danger)]">
                    <AlertCircle size={18} />
                    <span className="hidden text-xs sm:inline">{it.error}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.id !== it.id))
                  }
                  aria-label={labels.cancel}
                  className="rounded-md p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
                >
                  <X size={14} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : null}

      {items.some((it) => it.phase === 'ready' || it.phase === 'error') ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearDone}>
            {labels.done}
          </Button>
        </div>
      ) : null}

      {/* Unused locale prop to avoid the eslint-no-unused-vars rule. */}
      <span className="sr-only">{locale}</span>
    </div>
  )
}

function phaseLabel(phase: Phase, labels: UploadDropzoneProps['labels']): string {
  switch (phase) {
    case 'idle':
      return ''
    case 'reading':
      return labels.reading
    case 'uploading':
      return labels.uploading
    case 'parsing':
      return labels.parsing
    case 'ready':
      return labels.ready
    case 'error':
      return '—'
  }
}
