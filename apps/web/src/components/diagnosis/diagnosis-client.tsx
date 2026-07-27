'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MasteryRing, Button, CalmProgress } from '@mindmap/ui'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { QuestionCard } from './question-card'
import { ClarificationCard } from './clarification-card'
import { CalmThinking } from './calm-thinking'
import type { DiagnosisQuestion } from '@mindmap/brain'

interface DiagnosisClientProps {
  documentId: string
  workspaceId: string
  locale: 'en' | 'es'
  labels: {
    thinking: string
    complete: string
    mapReady: string
    startOver: string
    openMap: string
    iDontKnow: string
    skip: string
    submit: string
    openPlaceholder: string
    clarificationTitle: string
    clarificationPlaceholder: string
    clarificationSubmit: string
    reconnecting: string
    connectionLost: string
    questionsCompleted: string
    confidence: string
  }
  document: { id: string; filename: string; status: string }
}

interface PendingState {
  turnId: string
  question: DiagnosisQuestion
  microFeedback: string
}

interface ServerSnapshot {
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'ERRORED'
  questionsAsked: number
  globalConfidence: number
  documentId: string
  documentStatus: string
  pendingQuestion: { turnId: string; question: DiagnosisQuestion; microFeedback: string } | null
  awaitingClarification: boolean
  finished: boolean
  language: string
  maxQuestions: number
}

type Phase = 'idle' | 'thinking' | 'answering' | 'clarifying' | 'finished' | 'error'

export function DiagnosisClient({
  documentId,
  workspaceId,
  locale,
  labels,
  document,
}: DiagnosisClientProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, setPending] = useState<PendingState | null>(null)
  const [globalConfidence, setGlobalConfidence] = useState(0)
  const [questionsAsked, setQuestionsAsked] = useState(0)
  const [maxQuestions, setMaxQuestions] = useState(12)
  const [microFeedback, setMicroFeedback] = useState('')
  const [clarification, setClarification] = useState<{
    text: string
    microFeedback: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'polling'>('connecting')
  const sessionIdRef = useRef<string | null>(null)
  const failCountRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const pollRef = useRef<number | null>(null)

  const bootstrap = useCallback(async () => {
    setPhase('thinking')
    setError(null)
    try {
      const startRes = await fetch('/api/diagnosis/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!startRes.ok) {
        const j = (await startRes.json().catch(() => ({}))) as { message?: string }
        setError(j.message ?? 'Could not start the diagnosis.')
        setPhase('error')
        return
      }
      const j = (await startRes.json()) as {
        sessionId: string
        firstQuestion: PendingState | null
        finished: boolean
        globalConfidence: number
      }
      sessionIdRef.current = j.sessionId
      setGlobalConfidence(j.globalConfidence)
      if (j.finished) {
        setPhase('finished')
        return
      }
      if (j.firstQuestion) {
        setPending(j.firstQuestion)
        setPhase('answering')
        const snap = await fetchSnapshot(j.sessionId)
        if (snap) setMaxQuestions(snap.maxQuestions)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.')
      setPhase('error')
    }
  }, [documentId])

  useEffect(() => {
    void bootstrap()
    return () => {
      abortRef.current?.abort()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [bootstrap])

  // Open SSE stream and keep a reference to reconnect after each answer.
  const openSSE = useCallback(() => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    abortRef.current?.abort()
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    const ac = new AbortController()
    abortRef.current = ac
    setSseStatus('connecting')
    void (async () => {
      try {
        const res = await fetch(`/api/diagnosis/${sessionId}/next`, {
          headers: { accept: 'text/event-stream' },
          signal: ac.signal,
        })
        if (!res.ok || !res.body) {
          failCountRef.current += 1
          if (failCountRef.current >= 2) {
            setSseStatus('polling')
            startPolling(sessionId)
          } else {
            setTimeout(() => {
              if (!ac.signal.aborted) openSSE()
            }, 400)
          }
          return
        }
        setSseStatus('connected')
        failCountRef.current = 0
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''
          for (const frame of frames) {
            handleSseFrame(frame)
          }
        }
      } catch {
        if (ac.signal.aborted) return
        failCountRef.current += 1
        if (failCountRef.current >= 2) {
          setSseStatus('polling')
          startPolling(sessionId)
        } else {
          setTimeout(() => {
            if (!ac.signal.aborted) openSSE()
          }, 400)
        }
      }
    })()
  }, [])

  useEffect(() => {
    if (!sessionIdRef.current) return
    openSSE()
    return () => {
      abortRef.current?.abort()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [openSSE])

  function startPolling(sessionId: string) {
    if (typeof window === 'undefined') return
    const tick = async () => {
      const snap = await fetchSnapshot(sessionId)
      if (!snap) return
      if (snap.finished) {
        setPhase('finished')
        return
      }
      if (snap.pendingQuestion) {
        setPending(snap.pendingQuestion)
        setPhase('answering')
        setGlobalConfidence(snap.globalConfidence)
        setQuestionsAsked(snap.questionsAsked)
        setMaxQuestions(snap.maxQuestions)
      }
    }
    void tick()
    pollRef.current = window.setInterval(tick, 1000)
  }

  function handleSseFrame(frame: string) {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    if (event === 'state' && parsed && typeof parsed === 'object') {
      const p = parsed as { globalConfidence?: number; phase?: string; finished?: boolean }
      if (typeof p.globalConfidence === 'number') setGlobalConfidence(p.globalConfidence)
      if (p.phase === 'thinking') setPhase('thinking')
      if (p.finished) setPhase('finished')
    } else if (event === 'question' && parsed && typeof parsed === 'object') {
      const p = parsed as { turnId: string; question: DiagnosisQuestion; globalConfidence: number }
      setPending({ turnId: p.turnId, question: p.question, microFeedback: '' })
      setGlobalConfidence(p.globalConfidence)
      setPhase('answering')
    } else if (event === 'error') {
      const p = parsed as { message?: string }
      setError(p.message ?? 'The Mind could not respond.')
      setPhase('error')
    } else if (event === 'complete') {
      const p = parsed as { finished?: boolean }
      if (p.finished) setPhase('finished')
    }
  }

  const onAnswer = useCallback(
    async (
      answer:
        | { kind: 'MCQ'; optionIndex: number }
        | { kind: 'OPEN'; text: string }
        | { kind: 'IDONTKNOW' }
        | { kind: 'SKIP' },
    ) => {
      const sessionId = sessionIdRef.current
      const current = pending
      if (!sessionId || !current) return
      setPhase('thinking')
      setMicroFeedback('')
      try {
        const res = await fetch(`/api/diagnosis/${sessionId}/answer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ turnId: current.turnId, answer }),
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string }
          setError(j.message ?? 'Could not save your answer.')
          setPhase('error')
          return
        }
        const j = (await res.json()) as {
          finished: boolean
          microFeedback: string
          globalConfidence: number
          questionsAsked: number
          clarification: { text: string; microFeedback: string } | null
        }
        setMicroFeedback(j.microFeedback)
        setGlobalConfidence(j.globalConfidence)
        setQuestionsAsked(j.questionsAsked)
        if (j.clarification) {
          setClarification(j.clarification)
          setPhase('clarifying')
          return
        }
        if (j.finished) {
          setPhase('finished')
          return
        }
        // Immediately reconnect SSE to get the next question.
        setPending(null)
        failCountRef.current = 0
        openSSE()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error.')
        setPhase('error')
      }
    },
    [pending, openSSE],
  )

  const onClarification = useCallback(
    async (text: string) => {
      const sessionId = sessionIdRef.current
      if (!sessionId) return
      setPhase('thinking')
      try {
        const res = await fetch(`/api/diagnosis/${sessionId}/clarify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string }
          setError(j.message ?? 'Could not save your reply.')
          setPhase('error')
          return
        }
        const j = (await res.json()) as {
          microFeedback?: string
          evaluation: { microFeedback: string }
          finished: boolean
          globalConfidence: number
          questionsAsked: number
        }
        setMicroFeedback(j.evaluation.microFeedback)
        setGlobalConfidence(j.globalConfidence)
        setQuestionsAsked(j.questionsAsked)
        setClarification(null)
        if (j.finished) {
          setPhase('finished')
          return
        }
        // Immediately reconnect SSE to get the next question.
        setPending(null)
        failCountRef.current = 0
        openSSE()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error.')
        setPhase('error')
      }
    },
    [openSSE],
  )

  const onStartOver = useCallback(() => {
    setPhase('thinking')
    setError(null)
    setPending(null)
    setClarification(null)
    setMicroFeedback('')
    sessionIdRef.current = null
    failCountRef.current = 0
    void bootstrap()
  }, [bootstrap])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
          <span className="truncate">{document.filename}</span>
          <span>
            {labels.questionsCompleted}: {questionsAsked}/{maxQuestions}
          </span>
        </div>
        <CalmProgress value={maxQuestions > 0 ? questionsAsked / maxQuestions : 0} size="sm" />
        <div className="flex items-center gap-3">
          <MasteryRing mastery={globalConfidence} confidence={0.8} size={48} showLabel />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--color-fg-muted)]">
              {labels.confidence}
            </p>
            <p className="text-sm text-[var(--color-fg-muted)]">
              {Math.round(globalConfidence * 100)}% — calm, not a grade.
            </p>
          </div>
        </div>
      </header>

      <main className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <AnimatePresence mode="wait">
          {phase === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 text-center"
            >
              <p className="text-sm text-[var(--color-fg)]">{error ?? labels.connectionLost}</p>
              <Button onClick={onStartOver} variant="secondary" size="sm">
                <RotateCcw size={14} />
                {labels.startOver}
              </Button>
            </motion.div>
          ) : phase === 'finished' ? (
            <motion.div
              key="finished"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5 text-center"
            >
              <h2 className="text-tagline font-semibold text-[var(--color-fg)]">
                {labels.complete}
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)]">{labels.mapReady}</p>
              <Button
                onClick={() => router.push(`/${locale}/mind/${workspaceId}/map/${documentId}`)}
                size="md"
              >
                {labels.openMap}
                <ArrowRight size={14} />
              </Button>
            </motion.div>
          ) : phase === 'clarifying' && clarification ? (
            <ClarificationCard
              key="clarify"
              text={clarification.text}
              microFeedback={clarification.microFeedback}
              onSubmit={onClarification}
              disabled={false}
              labels={{
                title: labels.clarificationTitle,
                placeholder: labels.clarificationPlaceholder,
                submit: labels.clarificationSubmit,
              }}
            />
          ) : phase === 'answering' && pending ? (
            <motion.div
              key={`q-${pending.turnId}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <QuestionCard
                question={pending.question}
                microFeedback={microFeedback}
                onSubmit={onAnswer}
                disabled={false}
                labels={{
                  iDontKnow: labels.iDontKnow,
                  skip: labels.skip,
                  submit: labels.submit,
                  openPlaceholder: labels.openPlaceholder,
                }}
              />
            </motion.div>
          ) : (
            <CalmThinking key="thinking" label={labels.thinking} />
          )}
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
        <span>
          {sseStatus === 'connected' ? '' : sseStatus === 'polling' ? labels.reconnecting : ''}
        </span>
      </footer>
    </div>
  )
}

async function fetchSnapshot(sessionId: string): Promise<ServerSnapshot | null> {
  try {
    const r = await fetch(`/api/diagnosis/${sessionId}`, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as ServerSnapshot
  } catch {
    return null
  }
}
