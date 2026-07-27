'use client'

import { useSession, signOut } from '@mindmap/auth/client'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export function Navbar({ locale }: { locale: string }) {
  const { data: session, isPending } = useSession()
  const tNav = useTranslations('nav')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push(`/${locale}`)
    router.refresh()
  }

  if (isPending) {
    return (
      <nav className="flex items-center gap-5 text-xs">
        <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
      </nav>
    )
  }

  if (session?.user) {
    return (
      <nav className="flex items-center gap-5 text-xs">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 rounded-full py-1.5 text-white/80 transition-colors hover:text-white"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] text-white">
              {session.user.name?.charAt(0).toUpperCase() || '?'}
            </span>
            <span>{session.user.name || session.user.email}</span>
            <svg
              className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="py-1">
                <a
                  href={`/${locale}/settings`}
                  className="block px-4 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
                  onClick={() => setIsOpen(false)}
                >
                  {tNav('settings')}
                </a>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
                >
                  {tNav('signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-5 text-xs">
      <a href={`/${locale}/sign-in`} className="text-white/80 transition-colors hover:text-white">
        {tCommon('signIn')}
      </a>
      <a
        href={`/${locale}/sign-in`}
        className="rounded-full bg-[var(--color-primary)] px-3.5 py-1.5 text-white transition-all duration-150 ease-in-out hover:bg-[var(--color-primary-hover)] active:scale-95"
      >
        {tCommon('getStarted')}
      </a>
    </nav>
  )
}
