'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@mindmap/ui'
import { signIn } from '@mindmap/auth/client'

type Mode = 'login' | 'register'

export function SignInForm({ callbackPath }: { callbackPath: string }) {
  const t = useTranslations('auth.signIn')
  const tSignUp = useTranslations('auth.signUp')
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    startTransition(async () => {
      try {
        if (mode === 'register') {
          const res = await signUp.email({
            email,
            password,
            name: name || (email.split('@')[0] ?? 'User'),
            callbackURL: callbackPath,
          })
          if (res.error) {
            setError(res.error.message ?? tSignUp('errorGeneric'))
            return
          }
        } else {
          const res = await signIn.email({
            email,
            password,
            callbackURL: callbackPath,
          })
          if (res.error) {
            setError(res.error.message ?? t('errorGeneric'))
            return
          }
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
          onClick={() => {
            setMode('login')
            setError(null)
          }}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-all duration-150 ease-in-out active:scale-95 ${
            mode === 'login'
              ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'font-normal text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {t('tabLogin')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register')
            setError(null)
          }}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-all duration-150 ease-in-out active:scale-95 ${
            mode === 'register'
              ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'font-normal text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          {tSignUp('tabRegister')}
        </button>
      </div>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
        {mode === 'register' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{tSignUp('nameLabel')}</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tSignUp('namePlaceholder')}
            />
          </div>
        )}
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
          />
        </div>
        <Button type="submit" disabled={pending || !email || !password} className="w-full">
          {mode === 'login' ? t('signInButton') : tSignUp('registerButton')}
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

const signUp = {
  email: async (data: { email: string; password: string; name: string; callbackURL: string }) => {
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) {
      return { error: { message: json.message ?? 'Registration failed' } }
    }
    return { data: json }
  },
}
