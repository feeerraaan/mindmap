import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'
import { asLocale } from '@/lib/preferences'
import { loadTimelineForUser } from '@/features/timeline/actions'
import { TimelineViewComponent } from '@/components/timeline/timeline-view'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'

export const dynamic = 'force-dynamic'

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>
}) {
  const { locale: rawLocale, workspaceId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/timeline`)

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true },
  })
  if (!ws) notFound()

  const data = await loadTimelineForUser(user.id)
  const t = await getTranslations({ locale, namespace: 'timeline' })
  const tDoc = await getTranslations({ locale, namespace: 'documents' })
  const tMind = await getTranslations({ locale, namespace: 'mind' })

  return (
    <div>
      <WorkspaceSubNav
        labels={{
          timeline: tDoc('viewTimeline'),
          history: tDoc('viewHistory'),
          documents: tMind('untitled'),
          map: tDoc('viewMap'),
        }}
      />
      <TimelineViewComponent
        data={{
          ...data,
          today: data.today
            ? { ...data.today, itemCountLabel: t('itemCount', { count: data.today.items.length }) }
            : null,
          upcoming: data.upcoming.map((d) => ({
            ...d,
            itemCountLabel: t('itemCount', { count: d.items.length }),
          })),
          overdue: data.overdue.map((d) => ({
            ...d,
            itemCountLabel: t('itemCount', { count: d.items.length }),
          })),
        }}
        workspaceId={workspaceId}
        locale={locale}
        labels={{
          title: t('title'),
          subtitle: t('subtitle'),
          today: t('today'),
          overdue: t('overdue'),
          upcoming: t('upcoming'),
          emptyTitle: t('empty.title'),
          emptyBody: t('empty.body'),
          reasons: {
            decay: t('reasons.decay'),
            'new-weakness': t('reasons.new-weakness'),
            'dependency-gap': t('reasons.dependency-gap'),
            'first-review': t('reasons.first-review'),
            priority: t('reasons.priority'),
          },
          actions: {
            start: t('actions.start'),
            resume: t('actions.resume'),
            viewMap: t('actions.viewMap'),
          },
          stats: {
            todayItems: t('stats.todayItems', { count: data.stats.itemsDueToday }),
            upcomingItems: t('stats.upcomingItems', { count: data.stats.itemsUpcoming }),
          },
        }}
      />
    </div>
  )
}
