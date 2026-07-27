import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'
import { asLocale } from '@/lib/preferences'
import { loadHistoryForUser } from '@/features/timeline/actions'
import { HistoryList } from '@/components/history/history-list'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>
}) {
  const { locale: rawLocale, workspaceId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/history`)

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true },
  })
  if (!ws) notFound()

  const data = await loadHistoryForUser(user.id, workspaceId, 10)
  const t = await getTranslations({ locale, namespace: 'history' })
  const tDoc = await getTranslations({ locale, namespace: 'documents' })

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
      <HistoryList
        data={{
          ...data,
          entries: data.entries.map((e) => ({
            ...e,
            deltaLabel: e.delta !== null ? t('delta', { value: e.delta.toFixed(2) }) : undefined,
            questionsLabel: t('items', { count: e.questionsAsked }),
          })),
        }}
        workspaceId={workspaceId}
        locale={locale}
        labels={{
          title: t('title'),
          subtitle: t('subtitle'),
          diagnosis: t('diagnosis'),
          review: t('review'),
          confidence: t('confidence'),
          noDelta: t('noDelta'),
          emptyTitle: t('empty.title'),
          emptyBody: t('empty.body'),
          viewMap: t('viewMap'),
        }}
      />
    </div>
  )
}
