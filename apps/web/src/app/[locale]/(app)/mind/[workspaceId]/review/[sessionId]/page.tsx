import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'
import { asLocale } from '@/lib/preferences'
import { startReviewSession } from '@/features/timeline/actions'
import { ReviewSessionClient } from '@/components/timeline/review-session'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'

export const dynamic = 'force-dynamic'

export default async function ReviewSessionPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string; sessionId: string }>
}) {
  const { locale: rawLocale, workspaceId, sessionId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/review/${sessionId}`)
  }

  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true },
  })
  if (!ws) notFound()

  const view = await startReviewSession(sessionId, user.id)
  if (!view) notFound()

  const t = await getTranslations({ locale, namespace: 'review' })
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
      <ReviewSessionClient
        initial={view}
        workspaceId={workspaceId}
        locale={locale}
        labels={{
          title: t('title'),
          subtitle: t('subtitle'),
          knew: t('knew'),
          didnt: t('didnt'),
          skip: t('skip'),
          next: t('next'),
          finish: t('finish'),
          progressTemplate: t('progress', { current: '{current}', total: '{total}' }),
          completeTitle: t('complete.title'),
          completeBody: t('complete.body'),
          completeBack: t('complete.viewTimeline'),
        }}
      />
    </div>
  )
}
