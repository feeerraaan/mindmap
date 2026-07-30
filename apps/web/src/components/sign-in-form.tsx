'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@mindmap/ui'
import { signIn } from '@mindmap/auth/client'

export function SignInForm({ callbackPath }: { callbackPath: string }) {
  const t = useTranslations('auth.signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await signIn.email({
          email,
          password,
          callbackURL: callbackPath,
        })
        if (res.error) {
          setError(res.error.message ?? t('errorGeneric'))
          return
        }
        window.location.href = callbackPath
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })
  }

  const handleDemoLogin = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await signIn.email({
          email: 'demo@mindmap.com',
          password: 'Amo8931f!123',
          callbackURL: callbackPath,
        })
        if (res.error) {
          setError(res.error.message ?? t('errorGeneric'))
          return
        }
        window.location.href = callbackPath
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-full bg-[var(--color-bg-muted)] p-0.5">
        <button
          type="button"
          disabled
          className="flex-1 rounded-full px-3 py-1.5 text-sm font-semibold bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] cursor-default"
        >
          {t('tabLogin')}
        </button>
      </div>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
          />
        </div>
        <Button type="submit" disabled={pending || !email || !password} className="w-full">
          {t('signInButton')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-[var(--color-fg-subtle)]">
        <hr className="flex-1 border-t border-[var(--color-border-subtle)]" />
        <span>{t('demoButton')}</span>
        <hr className="flex-1 border-t border-[var(--color-border-subtle)]" />
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={pending}
          className="shrink-0 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
        >
          {t('demoButton')}
        </button>
      </div>

      <p className="text-center text-xs text-[var(--color-fg-subtle)]">
        {t('signupsClosed')}
      </p>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
