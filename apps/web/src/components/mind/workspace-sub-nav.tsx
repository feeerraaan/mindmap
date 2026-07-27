'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useParams } from 'next/navigation'
import { Calendar, History, FileText, Map as MapIcon } from 'lucide-react'

interface WorkspaceSubNavProps {
  labels: { timeline: string; history: string; documents: string; map: string }
}

/**
 * Sub-navigation for the workspace-level views. Renders a horizontal tab
 * strip on mobile (scrollable) and a vertical side rail on md+.
 */
export function WorkspaceSubNav({ labels }: WorkspaceSubNavProps) {
  const pathname = usePathname()
  const params = useParams<{ workspaceId: string }>()
  const wsId = params?.workspaceId
  const locale = (params as { locale?: string } | undefined)?.locale ?? 'en'
  if (!wsId) return null

  const base = `/${locale}/mind/${wsId}`
  const items = [
    { href: base, label: labels.documents, icon: <FileText size={14} />, exact: true },
    {
      href: `${base}/map`,
      label: labels.map,
      icon: <MapIcon size={14} />,
      exact: false,
    },
    {
      href: `${base}/timeline`,
      label: labels.timeline,
      icon: <Calendar size={14} />,
      exact: false,
    },
    { href: `${base}/history`, label: labels.history, icon: <History size={14} />, exact: false },
  ]

  return (
    <nav
      aria-label="Workspace sections"
      className="flex gap-1 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]/80 px-4 py-2 text-sm backdrop-blur-xl backdrop-saturate-150 md:sticky md:top-0 md:z-10 md:px-8"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors ' +
              (active
                ? 'bg-[var(--color-surface)] font-semibold text-[var(--color-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')
            }
          >
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
