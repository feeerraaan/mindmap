import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mindmap/ui'
import NextLink from 'next/link'
import { SignInForm } from '@/components/sign-in-form'
import { Link } from '@/i18n/routing'
import { getCurrentUser } from '@mindmap/auth'

export const dynamic = 'force-dynamic'

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ callbackPath?: string }>
}) {
  const { locale } = await params
  const { callbackPath } = await searchParams
  setRequestLocale(locale)

  // If already logged in, redirect to the app.
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/mind`)

  const t = await getTranslations({ locale, namespace: 'auth.signIn' })
  const isDev = process.env.NODE_ENV !== 'production'
  const target = callbackPath ?? `/${locale}/mind`

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-md flex-col items-center justify-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm callbackPath={target} />
        </CardContent>
      </Card>
      {isDev ? (
        <p className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
          Dev shortcut:{' '}
          <NextLink
            href={`/api/dev/sign-in?email=demo@mindmap.app&callbackPath=${encodeURIComponent(`/${locale}/mind`)}`}
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            sign in as demo
          </NextLink>
        </p>
      ) : null}
      <p className="mt-2 text-center text-xs text-[var(--color-fg-subtle)]">
        <Link href="/" className="hover:text-[var(--color-fg-muted)]">
          ← MindMap
        </Link>
      </p>
    </div>
  )
}
