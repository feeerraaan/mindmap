import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { asLocale } from '@/lib/preferences'
import { DiagnosisClient } from '@/components/diagnosis/diagnosis-client'

export const dynamic = 'force-dynamic'

export default async function DiagnosePage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string; documentId: string }>
}) {
  const { locale: rawLocale, workspaceId, documentId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user)
    redirect(
      `/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/diagnose/${documentId}`,
    )

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { workspace: { select: { id: true, ownerId: true, name: true, emoji: true } } },
  })
  if (!doc || doc.workspace.ownerId !== user.id || doc.workspaceId !== workspaceId) {
    notFound()
  }

  const tDiagnosis = await getTranslations({ locale, namespace: 'diagnosis' })
  const labels = {
    thinking: tDiagnosis('thinking'),
    complete: tDiagnosis('complete'),
    mapReady: tDiagnosis('mapReady'),
    startOver: tDiagnosis('startOver'),
    openMap: tDiagnosis('openMap'),
    iDontKnow: tDiagnosis('iDontKnow'),
    skip: tDiagnosis('skip'),
    submit: tDiagnosis('submit'),
    openPlaceholder: tDiagnosis('openPlaceholder'),
    clarificationTitle: tDiagnosis('clarificationTitle'),
    clarificationPlaceholder: tDiagnosis('clarificationPlaceholder'),
    clarificationSubmit: tDiagnosis('clarificationSubmit'),
    reconnecting: tDiagnosis('reconnecting'),
    connectionLost: tDiagnosis('connectionLost'),
    questionsCompleted: tDiagnosis('questionsCompleted'),
    confidence: tDiagnosis('confidence'),
  }

  return (
    <DiagnosisClient
      documentId={documentId}
      workspaceId={workspaceId}
      locale={locale}
      labels={labels}
      document={{ id: doc.id, filename: doc.filename, status: doc.status }}
    />
  )
}
