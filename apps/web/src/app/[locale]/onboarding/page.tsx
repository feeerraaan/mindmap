import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { prisma } from '@mindmap/database'
import { getCurrentUser } from '@mindmap/auth'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { asLocale } from '@/lib/preferences'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = asLocale(rawLocale)
  setRequestLocale(locale)
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/sign-in?callbackPath=/${locale}/onboarding`)

  // If the user already has a Mind, send them home — onboarding is a one-time moment.
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  })
  if (existing) redirect(`/${locale}/mind/${existing.id}`)

  const t = await getTranslations({ locale, namespace: 'onboarding' })

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col justify-center px-6 py-12">
      <OnboardingFlow
        locale={locale}
        labels={{
          title: t('title'),
          subtitle: t('subtitle'),
          step1Title: t('step1.title'),
          step1Subtitle: t('step1.subtitle'),
          step2Title: t('step2.title'),
          step2Subtitle: t('step2.subtitle'),
          step3Title: t('step3.title'),
          step3Subtitle: t('step3.subtitle'),
          medicine: t('step1.options.medicine'),
          law: t('step1.options.law'),
          finance: t('step1.options.finance'),
          engineering: t('step1.options.engineering'),
          language: t('step1.options.language'),
          other: t('step1.options.other'),
          low: t('step2.low'),
          mid: t('step2.mid'),
          high: t('step2.high'),
          placeholder: t('step3.placeholder'),
          skip: t('step3.skip'),
          next: t('next'),
          back: t('back'),
          finish: t('finish'),
          progress: t('progress'),
        }}
      />
    </div>
  )
}
