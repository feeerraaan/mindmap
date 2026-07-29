import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { QueryProvider } from '@/lib/query-provider'
import { ThemeScript } from '@/components/theme-script'
import { getThemeCookie } from '@/lib/preferences'
import { getCurrentUser } from '@mindmap/auth'
import { Navbar } from '@/components/navbar'
import '@mindmap/ui/styles'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'),
  title: {
    default: 'Mindmap',
    template: '%s · Mindmap',
  },
  description:
    'MindMap diagnoses what you truly know vs. what you think you know. Upload a document, get a calm visual knowledge map and a personalized review timeline.',
  applicationName: 'MindMap',
  authors: [{ name: 'MindMap' }],
  keywords: ['learning', 'knowledge graph', 'adaptive learning', 'study', 'diagnosis'],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/icons/icon-180.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'MindMap',
    title: 'Mindmap',
    description: 'Discover what you truly know. Calm, honest, diagnostic.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mindmap',
    description: 'Discover what you truly know. Calm, honest, diagnostic.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
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
  const user = await getCurrentUser()

  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeScript initialTheme={theme} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <QueryProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-surface)] focus:px-3 focus:py-2"
            >
              Skip to main content
            </a>
            <div className="flex min-h-dvh flex-col">
              <header className="bg-[var(--color-nav)] px-6 md:px-8">
                <div className="flex h-11 w-full items-center justify-between">
                  <a
                    href={user ? `/${locale}/mind` : `/${locale}`}
                    className="flex items-center gap-2 text-xs tracking-[-0.01em] text-white"
                  >
                    <img
                      src="/icons/icon-48.png"
                      alt=""
                      className="size-5 rounded-[5px]"
                    />
                    {t('appName')}
                  </a>
                  <Navbar locale={locale} />
                </div>
              </header>
              <main id="main" className="flex-1">
                {children}
              </main>
              {!user && (
                <footer className="bg-[var(--color-bg-muted)] px-6 py-8 text-center text-xs leading-6 text-[var(--color-fg-muted)] md:px-8">
                  © {new Date().getFullYear()} MindMap
                </footer>
              )}
            </div>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
