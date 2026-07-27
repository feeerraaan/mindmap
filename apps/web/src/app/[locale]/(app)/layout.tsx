import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@mindmap/database'
import { setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@mindmap/auth'
import { AppShell } from '@/components/app-shell'
import { asLocale } from '@/lib/preferences'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/mind`)

  const tNav = await getTranslations({ locale, namespace: 'nav' })
  const tMind = await getTranslations({ locale, namespace: 'mind' })

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, emoji: true },
    take: 20,
  })

  type WorkspaceSummary = { id: string; name: string; emoji: string | null }

  return (
    <AppShell
      user={{
        name: user.name ?? null,
        email: user.email,
        image: typeof user.image === 'string' ? user.image : null,
      }}
      workspaces={workspaces.map((w: WorkspaceSummary) => ({
        id: w.id,
        name: w.name,
        emoji: w.emoji,
      }))}
      labels={{
        home: tNav('home'),
        settings: tNav('settings'),
        signOut: tNav('signOut'),
        newMind: tMind('new.title'),
      }}
    >
      {children}
    </AppShell>
  )
}
