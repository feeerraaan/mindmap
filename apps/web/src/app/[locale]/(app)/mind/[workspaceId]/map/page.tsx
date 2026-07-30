import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@mindmap/auth'
import { prisma } from '@mindmap/database'
import { Button, EmptyState } from '@mindmap/ui'
import { FileText } from 'lucide-react'
import { asLocale } from '@/lib/preferences'
import { Link } from '@/i18n/routing'
import { WorkspaceSubNav } from '@/components/mind/workspace-sub-nav'

export const dynamic = 'force-dynamic'

export default async function WorkspaceMapPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>
}) {
  const { locale: rawLocale, workspaceId } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind/${workspaceId}/map`)

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ownerId: user.id },
    select: { id: true, name: true, emoji: true },
  })
  if (!workspace) notFound()

  const documents = await prisma.document.findMany({
    where: { workspaceId, status: { in: ['MAPPED', 'DIAGNOSING'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, filename: true },
  })

  const t = await getTranslations({ locale, namespace: 'map' })
  const tDoc = await getTranslations({ locale, namespace: 'documents' })

  if (documents.length === 1) {
    const first = documents[0]
    if (first) redirect(`/${locale}/mind/${workspaceId}/map/${first.id}`)
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
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="pb-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-3xl leading-none">
              {workspace.emoji ?? '🧠'}
            </span>
            <h1 className="text-headline font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
              {workspace.name || t('title')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t('subtitle')}</p>
        </header>

        {documents.length === 0 ? (
          <EmptyState
            title={t('empty.title')}
            description={t('empty.body')}
            action={
              <Link href={`/mind/${workspaceId}/upload`}>
                <Button>{tDoc('diagnose')}</Button>
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="text-[var(--color-fg-muted)]">
                    <FileText size={16} />
                  </span>
                  <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                    {d.filename}
                  </span>
                </span>
                <Link href={`/mind/${workspaceId}/map/${d.id}`}>
                  <Button size="sm" variant="secondary">
                    {tDoc('seeMap')}
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
