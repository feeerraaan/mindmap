'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, Input, Label, Separator } from '@mindmap/ui'
import { updateProfile, updateTheme, requestAccountDeletion } from '@/features/account/actions'

interface Labels {
  account: string
  appearance: string
  language: string
  danger: string
  name: string
  email: string
  signedInAs: string
  saveName: string
  themeLabel: string
  themeHelp: string
  languageLabel: string
  languageHelp: string
  deleteTitle: string
  deleteBody: string
  deleteCta: string
}

interface Initial {
  name: string
  email: string
  theme: 'light' | 'dark' | 'system'
  uiLocale: 'en' | 'es'
}

export function SettingsForm({
  locale,
  initial,
  labels,
}: {
  locale: 'en' | 'es'
  initial: Initial
  labels: Labels
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [theme, setTheme] = useState(initial.theme)
  const [uiLocale, setUiLocale] = useState(initial.uiLocale)
  const [pending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function save() {
    startTransition(async () => {
      try {
        await updateProfile({ name, locale: uiLocale })
        setSavedAt(Date.now())
        router.refresh()
      } catch {
        /* noop */
      }
    })
  }

  function setThemeAndPersist(next: 'light' | 'dark' | 'system') {
    setTheme(next)
    startTransition(async () => {
      try {
        await updateTheme({ theme: next })
        if (typeof window !== 'undefined') {
          localStorage.setItem('mindmap-theme', next)
        }
        document.documentElement.setAttribute('data-theme', next)
        if (next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        router.refresh()
      } catch {
        /* noop */
      }
    })
  }

  function setLocaleAndPersist(next: 'en' | 'es') {
    setUiLocale(next)
    if (typeof window !== 'undefined') {
      document.cookie = `mindmap-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      window.location.href = `/${next}/settings`
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {labels.account}
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{labels.name}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{labels.email}</Label>
            <p className="text-sm text-[var(--color-fg-muted)]">
              {labels.signedInAs.replace('{email}', initial.email)}
            </p>
          </div>
          <div>
            <Button onClick={save} disabled={pending || name === initial.name}>
              {labels.saveName}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {labels.appearance}
          </h2>
          <div className="flex flex-col gap-2">
            <Label>{labels.themeLabel}</Label>
            <p className="text-xs text-[var(--color-fg-muted)]">{labels.themeHelp}</p>
            <div className="mt-1 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThemeAndPersist(t)}
                  aria-pressed={theme === t}
                  className={
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors ' +
                    (theme === t
                      ? 'bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {labels.language}
          </h2>
          <div className="flex flex-col gap-2">
            <Label>{labels.languageLabel}</Label>
            <p className="text-xs text-[var(--color-fg-muted)]">{labels.languageHelp}</p>
            <div className="mt-1 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-0.5">
              {(['en', 'es'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocaleAndPersist(l)}
                  aria-pressed={uiLocale === l}
                  className={
                    'rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors ' +
                    (uiLocale === l
                      ? 'bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
            {labels.danger}
          </h2>
          <h3 className="text-base font-semibold text-[var(--color-fg)]">{labels.deleteTitle}</h3>
          <p className="text-sm text-[var(--color-fg-muted)]">{labels.deleteBody}</p>
          <div>
            <Button
              variant="danger"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await requestAccountDeletion()
                  } catch {
                    /* noop */
                  }
                })
              }
            >
              {labels.deleteCta}
            </Button>
          </div>
        </CardContent>
      </Card>

      {savedAt ? (
        <p className="text-center text-xs text-[var(--color-fg-subtle)]" aria-live="polite">
          ✓
        </p>
      ) : null}
    </div>
  )
}
