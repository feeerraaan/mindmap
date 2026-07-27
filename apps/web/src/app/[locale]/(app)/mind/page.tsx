import { setRequestLocale, getTranslations } from 'next-intl/server'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { redirect } from 'next/navigation'
import { MindHeader } from '@mindmap/ui'
import { CreateMindInline } from '@/components/mind/create-mind-inline'
import { MindList } from '@/components/mind/mind-list'
import { asLocale } from '@/lib/preferences'

export const dynamic = 'force-dynamic'

export default async function MindIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind`)

  const [t, workspaces] = await Promise.all([
    getTranslations({ locale, namespace: 'mind' }),
    prisma.workspace.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        emoji: true,
        updatedAt: true,
        _count: { select: { documents: true } },
      },
    }),
  ])

  const firstId = workspaces[0]?.id

  type WorkspaceSummary = {
    id: string
    name: string
    emoji: string | null
    updatedAt: Date
    _count: { documents: number }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <MindHeader
        name={t('allMinds')}
        emoji="🧠"
        actions={
          <CreateMindInline
            locale={locale}
            placeholder={t('new.placeholder')}
            createLabel={t('new.create')}
            examDateLabel={t('new.examDate')}
            examDatePlaceholder={t('new.examDatePlaceholder')}
          />
        }
      />

      {workspaces.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-base font-medium text-[var(--color-fg)]">{t('noMinds')}</p>
          <p className="max-w-md text-sm text-[var(--color-fg-muted)]">{t('noMindsDescription')}</p>
        </div>
      ) : (
        <MindList
          locale={locale}
          workspaces={workspaces.map((w: WorkspaceSummary) => ({
            id: w.id,
            name: w.name,
            emoji: w.emoji,
            docCount: w._count.documents,
            updatedAt: w.updatedAt.toISOString(),
          }))}
          labels={{
            open: t('menu.open'),
            rename: t('menu.rename'),
            delete: t('menu.delete'),
            untitled: t('untitled'),
            confirmDelete: t('delete.confirm'),
            cancelDelete: t('delete.cancel'),
            deleteTitle: t('delete.title'),
            deleteDescription: t('delete.description'),
          }}
          firstId={firstId}
        />
      )}
    </div>
  )
}
