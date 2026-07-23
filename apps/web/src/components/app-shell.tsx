'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { signOut } from '@mindmap/auth/client'
import { Button, Separator } from '@mindmap/ui'
import { Plus, Settings, Home, LogOut, BookOpen } from 'lucide-react'

interface AppShellProps {
  user: { name: string | null; email: string; image: string | null }
  workspaces: Array<{ id: string; name: string; emoji: string | null }>
  labels: { home: string; settings: string; signOut: string; newMind: string }
  children: ReactNode
}

export function AppShell({ user, workspaces, labels, children }: AppShellProps) {
  const pathname = usePathname()
  const params = useParams<{ locale: string }>()
  const locale = params?.locale ?? 'en'
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      window.location.href = `/${locale}`
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — md+ */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 md:flex">
        <div className="px-2 pb-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--color-fg)]"
          >
            <span
              aria-hidden
              className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            >
              M
            </span>
            MindMap
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 text-sm">
          <SidebarLink href={`/${locale}/mind`} icon={<Home size={16} />} active={pathname === `/${locale}/mind`}>
            {labels.home}
          </SidebarLink>
          <SidebarLink
            href={`/${locale}/settings`}
            icon={<Settings size={16} />}
            active={pathname.startsWith(`/${locale}/settings`)}
          >
            {labels.settings}
          </SidebarLink>
        </nav>

        <Separator className="my-3" />

        <div className="flex items-center justify-between px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
          <span className="flex items-center gap-1.5">
            <BookOpen size={12} /> {labels.home}
          </span>
          <Link
            href={`/${locale}/mind`}
            className="rounded-md p-1 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
            aria-label={labels.newMind}
          >
            <Plus size={14} />
          </Link>
        </div>

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-2 text-sm">
          {workspaces.map((ws) => {
            const active = pathname === `/${locale}/mind/${ws.id}`
            return (
              <li key={ws.id}>
                <Link
                  href={`/${locale}/mind/${ws.id}`}
                  className={
                    'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ' +
                    (active
                      ? 'bg-[var(--color-bg-muted)] text-[var(--color-fg)]'
                      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]')
                  }
                >
                  <span aria-hidden className="text-base leading-none">
                    {ws.emoji ?? '🧠'}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <Separator className="my-3" />

        <div className="flex items-center gap-2 px-2 py-1.5">
          <div
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-xs font-semibold text-[var(--color-fg-muted)]"
          >
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium text-[var(--color-fg)]">{user.name ?? user.email}</p>
            <p className="truncate text-[var(--color-fg-subtle)]">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={labels.signOut}
            className="rounded-md p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 py-3 backdrop-blur md:hidden">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden
              className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            >
              M
            </span>
            MindMap
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={14} />
          </Button>
        </header>

        <main className="flex-1">{children}</main>

        {/* Mobile bottom tab */}
        <nav className="sticky bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
          <BottomTab href={`/${locale}/mind`} icon={<Home size={18} />} label={labels.home} active={pathname.startsWith(`/${locale}/mind`)} />
          <BottomTab href={`/${locale}/settings`} icon={<Settings size={18} />} label={labels.settings} active={pathname.startsWith(`/${locale}/settings`)} />
        </nav>
      </div>
    </div>
  )
}

function SidebarLink({
  href,
  icon,
  active,
  children,
}: {
  href: string
  icon: ReactNode
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ' +
        (active
          ? 'bg-[var(--color-bg-muted)] text-[var(--color-fg)]'
          : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]')
      }
    >
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

function BottomTab({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: ReactNode
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={
        'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors ' +
        (active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]')
      }
    >
      <AnimatePresence>
        {active ? (
          <motion.span
            layoutId="bottom-tab"
            className="absolute inset-x-0 top-0 h-0.5 bg-[var(--color-accent)]"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
      </AnimatePresence>
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
