import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@mindmap/auth'
import { Button } from '@mindmap/ui'
import { Link } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/mind`)

  const t = await getTranslations({ locale, namespace: 'marketing' })

  return (
    <div>
      {/* Hero — white tile */}
      <section className="flex flex-col items-center gap-6 bg-[var(--color-bg)] px-6 py-16 text-center md:py-20">
        <h1 className="text-display md:text-hero max-w-3xl font-semibold tracking-[-0.0175rem] text-balance text-[var(--color-fg)]">
          {t('hero.title')}
        </h1>
        <p className="text-lead max-w-2xl font-normal text-pretty text-[var(--color-fg-muted)]">
          {t('hero.subtitle')}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-in">
            <Button size="lg">{t('hero.primary')}</Button>
          </Link>
          <Link href="#how-it-works">
            <Button size="lg" variant="secondary">
              {t('hero.secondary')}
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works — parchment tile */}
      <section id="how-it-works" className="bg-[var(--color-bg-muted)] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-headline mb-12 text-center font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {t('howItWorks.title')}
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                <span
                  aria-hidden
                  className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white"
                >
                  {n}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-[var(--color-fg)]">
                  {t(`howItWorks.steps.${n}.title` as 'howItWorks.steps.1.title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {t(`howItWorks.steps.${n}.body` as 'howItWorks.steps.1.body')}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Principles — white tile */}
      <section className="bg-[var(--color-bg)] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-headline mb-12 text-center font-semibold tracking-[-0.023em] text-[var(--color-fg)]">
            {t('principles.title')}
          </h2>
          <ul className="grid gap-4">
            {[1, 2, 3, 4].map((n) => (
              <li
                key={n}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
                />
                <span className="text-[17px] leading-relaxed text-[var(--color-fg)]">
                  {t(`principles.${n}` as 'principles.1')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

    </div>
  )
}
