import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Geist, Geist_Mono } from 'next/font/google'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/lib/query-provider'
import { ThemeScript } from '@/components/theme-script'
import { getThemeCookie } from '@/lib/preferences'
import '@mindmap/ui/styles'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'),
  title: {
    default: 'MindMap — An MRI scan for knowledge',
    template: '%s · MindMap',
  },
  description:
    'MindMap diagnoses what you truly know vs. what you think you know. Upload a document, get a calm visual knowledge map and a personalized review timeline.',
  applicationName: 'MindMap',
  authors: [{ name: 'MindMap' }],
  keywords: ['learning', 'knowledge graph', 'adaptive learning', 'study', 'diagnosis'],
  openGraph: {
    type: 'website',
    siteName: 'MindMap',
    title: 'MindMap — An MRI scan for knowledge',
    description: 'Discover what you truly know. Calm, honest, diagnostic.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MindMap — An MRI scan for knowledge',
    description: 'Discover what you truly know. Calm, honest, diagnostic.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-192.png',
  },
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound()
  }
  setRequestLocale(locale)
  const messages = await getMessages()
  const t = await getTranslations({ locale, namespace: 'common' })
  const theme = await getThemeCookie()

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={geistSans.variable + ' ' + geistMono.variable}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript initialTheme={theme} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#1f8e9e" />
      </head>
      <body className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <QueryProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-surface)] focus:px-3 focus:py-2"
            >
              Skip to main content
            </a>
            <div className="flex min-h-dvh flex-col">
              <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 py-4 backdrop-blur md:px-8">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                  <a
                    href={`/${locale}`}
                    className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--color-fg)]"
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                    >
                      M
                    </span>
                    {t('appName')}
                  </a>
                  <nav className="flex items-center gap-3 text-sm">
                    <a
                      href={`/${locale}/sign-in`}
                      className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      {t('signIn')}
                    </a>
                    <a
                      href={`/${locale}/sign-in`}
                      className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[var(--color-accent-fg)] shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
                    >
                      {t('getStarted')}
                    </a>
                  </nav>
                </div>
              </header>
              <main id="main" className="flex-1">
                {children}
              </main>
              <footer className="border-t border-[var(--color-border)] px-6 py-6 text-center text-xs text-[var(--color-fg-subtle)] md:px-8">
                © {new Date().getFullYear()} MindMap
              </footer>
            </div>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
