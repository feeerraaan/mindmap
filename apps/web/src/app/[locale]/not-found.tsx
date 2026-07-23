import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@mindmap/ui'

export default async function NotFound() {
  // Best-effort locale; default to 'en' since we may not have it in the URL.
  const locale = 'en'
  setRequestLocale(locale)
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-[var(--color-fg-muted)]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
        Page not found
      </h1>
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
        The page you were looking for doesn't exist or was moved.
      </p>
      <Link href="/">
        <Button>← MindMap</Button>
      </Link>
    </div>
  )
}

// Avoid a build-time unused import warning.
export const dynamic = 'force-static'
void getTranslations
