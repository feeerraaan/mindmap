import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { EmptyState, Button } from '@mindmap/ui'
import { Calendar, History } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { asLocale } from '@/lib/preferences'
import { DocumentList } from '@/components/documents/document-list'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>
}) {
  const { locale: rawLocale, workspaceId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}`)

  const [workspace, t, tUpload, tDocs] = await Promise.all([
    prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: user.id },
      select: { id: true, name: true, emoji: true, examDate: true },
    }),
    getTranslations({ locale, namespace: 'mind' }),
    getTranslations({ locale, namespace: 'upload' }),
    getTranslations({ locale, namespace: 'documents' }),
  ])
  if (!workspace) notFound()

  const documents = await prisma.document.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      status: true,
      sizeBytes: true,
      pageCount: true,
      createdAt: true,
      _count: { select: { concepts: true } },
    },
  })

  return (
    <div>
      <WorkspaceSubNav
        labels={{
          timeline: tDocs('viewTimeline'),
          history: tDocs('viewHistory'),
          documents: tDocs('viewDocuments'),
          map: tDocs('viewMap'),
        }}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-3xl leading-none">
              {workspace.emoji ?? '🧠'}
            </span>
            <div>
              <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
                {workspace.name || t('untitled')}
              </h1>
              {workspace.examDate ? (
                <p className="text-xs text-[var(--color-fg-subtle)]">
                  {t('examDate')}: {workspace.examDate.toLocaleDateString(locale)}
                </p>
              ) : null}
            </div>
          </div>
          <Link href={`/mind/${workspace.id}/upload`}>
            <Button size="sm">{t('empty.upload')}</Button>
          </Link>
          <div className="ml-2 hidden gap-1 md:flex">
            <Link href={`/mind/${workspace.id}/timeline`}>
              <Button variant="ghost" size="sm">
                <Calendar size={14} />
                {tDocs('viewTimeline')}
              </Button>
            </Link>
            <Link href={`/mind/${workspace.id}/history`}>
              <Button variant="ghost" size="sm">
                <History size={14} />
                {tDocs('viewHistory')}
              </Button>
            </Link>
          </div>
        </div>

        {documents.length === 0 ? (
          <>
            <EmptyState
              title={t('empty.title')}
              description={t('empty.description')}
              action={
                <Link href={`/mind/${workspace.id}/upload`}>
                  <Button>{t('empty.upload')}</Button>
                </Link>
              }
            />
            <p className="mt-3 text-center text-xs text-[var(--color-fg-subtle)]">
              {t('empty.uploadHint')}
            </p>
          </>
        ) : (
          <DocumentList
            locale={locale}
            workspaceId={workspace.id}
            documents={documents.map((d) => {
              const conceptCount =
                d.status === 'READY' || d.status === 'DIAGNOSING' || d.status === 'MAPPED'
                  ? d._count.concepts
                  : null
              return {
                id: d.id,
                filename: d.filename,
                status: d.status,
                sizeBytes: d.sizeBytes,
                pageCount: d.pageCount,
                createdAt: d.createdAt.toISOString(),
                conceptCount,
                conceptsLabel:
                  conceptCount !== null ? tDocs('concepts', { count: conceptCount }) : null,
              }
            })}
            labels={{
              reading: tUpload('reading'),
              uploading: tUpload('uploading'),
              parsing: tUpload('parsing'),
              ready: tUpload('ready'),
              graphing: tDocs('graphing'),
              open: tDocs('open'),
              diagnose: tDocs('diagnose'),
              continueDiagnosis: tDocs('continueDiagnosis', { defaultMessage: 'Continue' }),
              deleteTitle: tDocs('deleteTitle'),
              deleteDescription: tDocs('deleteDescription'),
              deleteConfirm: tDocs('deleteConfirm'),
              deleteCancel: tDocs('deleteCancel'),
            }}
          />
        )}
      </div>
    </div>
  )
}
