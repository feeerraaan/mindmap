'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@mindmap/ui'
import { signIn } from '@mindmap/auth/client'

export function SignInForm({ callbackPath }: { callbackPath: string }) {
  const t = useTranslations('auth.signIn')
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [linkSent, setLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = () => {
    startTransition(async () => {
      try {
        await signIn.social({
          provider: 'google',
          callbackURL: callbackPath,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })
  }

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    startTransition(async () => {
      try {
        await signIn.magicLink({
          email,
          callbackURL: callbackPath,
        })
        setLinkSent(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })
  }

  if (linkSent) {
    return (
      <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm leading-relaxed text-[var(--color-fg)]">
        {t('linkSent')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={handleGoogle}
        disabled={pending}
        variant="secondary"
        className="w-full"
        type="button"
      >
        {t('google')}
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[var(--color-surface)] px-2 text-[var(--color-fg-subtle)]">or</span>
        </div>
      </div>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
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
        <Button type="submit" disabled={pending || !email} className="w-full">
          {t('sendLink')}
        </Button>
      </form>

      {error ? (
        <p className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
