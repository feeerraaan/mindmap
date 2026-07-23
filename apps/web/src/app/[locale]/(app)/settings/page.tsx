import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { getThemeCookie, asLocale } from '@/lib/preferences'
import { SettingsForm } from '@/components/settings/settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/settings`)

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, locale: true },
  })

  const t = await getTranslations({ locale, namespace: 'settings' })
  const theme = await getThemeCookie()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-1 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">{t('title')}</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{t('subtitle')}</p>
      </header>
      <SettingsForm
        locale={locale}
        initial={{
          name: dbUser?.name ?? user.name ?? '',
          email: dbUser?.email ?? user.email,
          theme,
          uiLocale: (dbUser?.locale as 'en' | 'es') ?? locale,
        }}
        labels={{
          account: t('sections.account'),
          appearance: t('sections.appearance'),
          language: t('sections.language'),
          danger: t('sections.danger'),
          name: t('account.name'),
          email: t('account.email'),
          signedInAs: t('account.signedInAs'),
          saveName: t('account.saveName'),
          themeLabel: t('appearance.theme'),
          themeHelp: t('appearance.themeHelp'),
          languageLabel: t('language.label'),
          languageHelp: t('language.help'),
          deleteTitle: t('danger.deleteTitle'),
          deleteBody: t('danger.deleteBody'),
          deleteCta: t('danger.deleteCta'),
        }}
      />
    </div>
  )
}
