import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { Button, EmptyState } from '@mindmap/ui'
import { ChevronLeft, Calendar } from 'lucide-react'
import { asLocale } from '@/lib/preferences'
import { KnowledgeMap } from '@/components/map/knowledge-map'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'
import type { KnowledgeMapData, KnowledgeMapEdge, KnowledgeMapNode } from '@/components/map/types'

export const dynamic = 'force-dynamic'

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string; documentId: string }>
}) {
  const { locale: rawLocale, workspaceId, documentId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user)
    redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/map/${documentId}`)

  const [doc, states] = await Promise.all([
    prisma.document.findUnique({
      where: { id: documentId },
      include: {
        workspace: { select: { id: true, ownerId: true, name: true } },
        concepts: {
          orderBy: { importance: 'desc' },
          include: { dependsOn: true },
        },
      },
    }),
    prisma.conceptState.findMany({
      where: { userId: user.id, concept: { documentId } },
      select: {
        conceptId: true,
        mastery: true,
        confidence: true,
        attempts: true,
        correct: true,
        lastDelta: true,
        lastSeen: true,
        dueAt: true,
      },
    }),
  ])
  if (!doc || doc.workspaceId !== workspaceId || doc.workspace.ownerId !== user.id) {
    notFound()
  }
  const stateMap = new Map(states.map((s) => [s.conceptId, s]))

  const nodes: KnowledgeMapNode[] = doc.concepts.map((c) => {
    const s = stateMap.get(c.id)
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      chapter: c.chapter,
      topic: c.topic,
      importance: c.importance,
      difficulty: c.difficulty,
      mastery: s?.mastery ?? 0.1,
      confidence: s?.confidence ?? 0,
      attempts: s?.attempts ?? 0,
      correct: s?.correct ?? 0,
      lastDelta: s?.lastDelta ?? null,
      lastSeen: s?.lastSeen ? s.lastSeen.toISOString() : null,
      dueAt: s?.dueAt ? s.dueAt.toISOString() : null,
    }
  })

  const edges: KnowledgeMapEdge[] = doc.concepts.flatMap((c) =>
    c.dependsOn.map((d) => ({
      id: `${c.id}->${d.dependencyId}`,
      source: c.id,
      target: d.dependencyId,
      weight: d.weight,
    })),
  )

  const totals = {
    known: nodes.filter((n) => n.mastery >= 0.6 && n.confidence >= 0.6).length,
    thinkIKnow: nodes.filter((n) => n.mastery >= 0.4 && n.confidence < 0.6).length,
    dontKnow: nodes.filter((n) => n.attempts === 0 || n.mastery < 0.4).length,
    aboutToForget: nodes.filter(
      (n) => n.lastDelta !== null && n.lastDelta < -0.05 && n.mastery < 0.7,
    ).length,
  }

  const data: KnowledgeMapData = {
    documentId: doc.id,
    documentName: doc.filename,
    nodes,
    edges,
    globalConfidence:
      nodes.length === 0 ? 0 : nodes.reduce((acc, n) => acc + n.mastery, 0) / nodes.length,
    totals,
  }

  const t = await getTranslations({ locale, namespace: 'map' })
  const tDoc = await getTranslations({ locale, namespace: 'documents' })

  if (doc.status !== 'MAPPED' && doc.status !== 'DIAGNOSING') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title={t('empty.title')}
          description={t('empty.body')}
          action={
            <Link href={`/${locale}/mind/${workspaceId}/diagnose/${documentId}`}>
              <Button>
                <Calendar size={14} />
                {tDoc('diagnose')}
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <WorkspaceSubNav
        labels={{
          timeline: tDoc('viewTimeline'),
          history: tDoc('viewHistory'),
          documents: tDoc('viewDocuments'),
          map: tDoc('viewMap'),
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="flex flex-col gap-2 pb-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-fg-subtle)]">
            <Link
              href={`/${locale}/mind/${workspaceId}`}
              className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
            >
              <ChevronLeft size={12} />
              {doc.workspace.name}
            </Link>
            <span>/</span>
            <span className="truncate">{doc.filename}</span>
          </div>
          <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {t('title')}
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">{t('subtitle')}</p>
        </header>
      </div>
      <KnowledgeMap
        data={data}
        locale={locale}
        labels={{
          subtitle: t('subtitle'),
          legendTitle: t('legend.title'),
          known: t('legend.known'),
          weak: t('legend.weak'),
          unknown: t('legend.unknown'),
          sideTitle: t('side.title'),
          sideClose: t('side.close'),
          sideOpenInTimeline: t('side.openInTimeline'),
          sideAttempts: t('side.attempts'),
          sideCorrect: t('side.correct'),
          sideLastSeen: t('side.lastSeen'),
          sideDue: t('side.due'),
          sideDependsOn: t('side.dependsOn'),
          sideDependedBy: t('side.dependedBy'),
          filters: {
            all: t('filters.all'),
            known: t('filters.known'),
            thinkIKnow: t('filters.thinkIKnow'),
            dontKnow: t('filters.dontKnow'),
            aboutToForget: t('filters.aboutToForget'),
          },
          mobileHint: t('mobileHint'),
          empty: { title: t('empty.title'), body: t('empty.body') },
        }}
        timelineHref={`/${locale}/mind/${workspaceId}/timeline`}
      />
    </div>
  )
}
