import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { EmptyState, Button } from '@mindmap/ui'
import { Link } from '@/i18n/routing'
import { asLocale } from '@/lib/preferences'
import { DocumentList } from '@/components/documents/document-list'

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

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true, name: true, emoji: true },
  })
  if (!workspace) notFound()

  const t = await getTranslations({ locale, namespace: 'mind' })
  const tUpload = await getTranslations({ locale, namespace: 'upload' })

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
    },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-3xl leading-none">
            {workspace.emoji ?? '🧠'}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
              {workspace.name || t('untitled')}
            </h1>
          </div>
        </div>
        <Link href={`/${locale}/mind/${workspace.id}/upload`}>
          <Button size="sm">{t('empty.upload')}</Button>
        </Link>
      </div>

      {documents.length === 0 ? (
        <>
          <EmptyState
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <Link href={`/${locale}/mind/${workspace.id}/upload`}>
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
          documents={documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            status: d.status,
            sizeBytes: d.sizeBytes,
            pageCount: d.pageCount,
            createdAt: d.createdAt.toISOString(),
          }))}
          labels={{
            reading: tUpload('reading'),
            uploading: tUpload('uploading'),
            parsing: tUpload('parsing'),
            ready: tUpload('ready'),
          }}
        />
      )}
    </div>
  )
}
