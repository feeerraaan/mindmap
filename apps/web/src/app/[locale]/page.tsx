import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Button } from '@mindmap/ui'
import { Link } from '@/i18n/routing'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'marketing' })

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-24 text-center md:py-32">
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-fg-muted)]">
          {t('hero.eyebrow')}
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--color-fg)] md:text-5xl">
          {t('hero.title')}
        </h1>
        <p className="max-w-2xl text-pretty text-lg leading-relaxed text-[var(--color-fg-muted)]">
          {t('hero.subtitle')}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link href="/sign-in">
            <Button size="lg">{t('hero.primary')}</Button>
          </Link>
          <Link href="#how-it-works">
            <Button size="lg" variant="outline">
              {t('hero.secondary')}
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-[var(--color-border)] py-20">
        <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--color-fg)] md:text-3xl">
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
                className="inline-flex size-8 items-center justify-center rounded-md bg-[var(--color-accent)]/10 text-sm font-semibold text-[var(--color-accent)]"
              >
                {n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-fg)]">
                {t(`howItWorks.steps.${n}.title` as 'howItWorks.steps.1.title')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {t(`howItWorks.steps.${n}.body` as 'howItWorks.steps.1.body')}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Principles */}
      <section className="border-t border-[var(--color-border)] py-20">
        <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--color-fg)] md:text-3xl">
          {t('principles.title')}
        </h2>
        <ul className="mx-auto grid max-w-3xl gap-4">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <span
                aria-hidden
                className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
              />
              <span className="text-base leading-relaxed text-[var(--color-fg)]">
                {t(`principles.${n}` as 'principles.1')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[var(--color-border)] py-20">
        <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight text-[var(--color-fg)] md:text-3xl">
          {t('pricing.title')}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <h3 className="text-xl font-semibold text-[var(--color-fg)]">
              {t('pricing.free.name')}
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
                {t('pricing.free.price')}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {t('pricing.free.description')}
            </p>
            <div className="pt-2">
              <Link href="/sign-in">
                <Button variant="secondary" className="w-full">
                  {t('pricing.free.cta')}
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative flex flex-col gap-4 rounded-lg border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-8">
            <span className="absolute -top-2 right-4 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent-fg)]">
              Pro
            </span>
            <h3 className="text-xl font-semibold text-[var(--color-fg)]">
              {t('pricing.pro.name')}
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
                {t('pricing.pro.price')}
              </span>
              <span className="text-sm text-[var(--color-fg-muted)]">
                {t('pricing.pro.period')}
              </span>
            </div>
            <p className="text-sm text-[var(--color-fg-muted)]">
              {t('pricing.pro.yearly')}
            </p>
            <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {t('pricing.pro.description')}
            </p>
            <div className="pt-2">
              <Link href="/sign-in?coupon=1">
                <Button className="w-full">{t('pricing.pro.cta')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
