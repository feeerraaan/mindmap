'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { signOut } from '@mindmap/auth/client'
import { Separator } from '@mindmap/ui'
import { Settings, Home, LogOut, BookOpen } from 'lucide-react'

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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/[0.08] bg-[var(--color-nav)] px-3 py-4 md:flex">
        <nav className="flex flex-col gap-0.5 text-sm">
          <SidebarLink
            href={`/${locale}/mind`}
            icon={<Home size={16} />}
            active={pathname === `/${locale}/mind`}
          >
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

        <Separator className="my-3 border-white/[0.08]" />

        <div className="flex items-center px-2 pb-1.5 text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <BookOpen size={12} /> {labels.home}
          </span>
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
                      ? 'bg-white/15 font-semibold text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white')
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

        <Separator className="my-3 border-white/[0.08]" />

        <div className="flex items-center gap-2 px-2 py-1.5">
          <div
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white"
          >
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold text-white">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-white/50">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={labels.signOut}
            className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[var(--color-nav)] px-4 py-3 md:hidden">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-semibold text-white">
              <img
                src="/icons/icon-64.png"
                alt="MindMap"
                className="size-9 rounded-lg"
              />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={labels.signOut}
            className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <LogOut size={16} />
          </button>
        </header>

        <main className="flex-1">{children}</main>

        {/* Mobile bottom tab */}
        <nav className="sticky bottom-0 z-10 flex border-t border-white/[0.08] bg-[var(--color-nav)] md:hidden">
          <BottomTab
            href={`/${locale}/mind`}
            icon={<Home size={18} />}
            label={labels.home}
            active={pathname.startsWith(`/${locale}/mind`)}
          />
          <BottomTab
            href={`/${locale}/settings`}
            icon={<Settings size={18} />}
            label={labels.settings}
            active={pathname.startsWith(`/${locale}/settings`)}
          />
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
          ? 'bg-white/15 font-semibold text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white')
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
        'relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors ' +
        (active ? 'text-white' : 'text-white/50')
      }
    >
      <AnimatePresence>
        {active ? (
          <motion.span
            layoutId="bottom-tab"
            className="absolute inset-x-0 top-0 h-0.5 rounded-full bg-[var(--color-primary)]"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          />
        ) : null}
      </AnimatePresence>
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
