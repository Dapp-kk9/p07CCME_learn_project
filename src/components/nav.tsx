'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { CalendarDays, CalendarPlus, ClipboardList, Home, LayoutDashboard, Settings, Stethoscope, UserRound, Users, KeyRound } from 'lucide-react'

const ICONS = { home: Home, book: CalendarPlus, list: CalendarDays, user: UserRound, queue: ClipboardList, dash: LayoutDashboard, doctors: Stethoscope, staff: Users, settings: Settings, key: KeyRound }
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS }

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'side' | 'bottom' }) {
  const path = usePathname()
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'))
  return (
    <nav aria-label="Main" className={variant === 'side' ? 'flex flex-col gap-1' : 'grid auto-cols-fr grid-flow-col'}>
      {items.map((it) => {
        const Icon = ICONS[it.icon]
        const on = active(it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? 'page' : undefined}
            className={clsx(
              variant === 'side'
                ? 'flex min-h-10 items-center gap-3 rounded-md px-3 text-[15px]'
                : 'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
              on ? 'bg-brand-soft font-semibold text-brand-dark' : 'text-muted hover:bg-brand-soft/60',
            )}
          >
            <Icon size={variant === 'side' ? 18 : 20} aria-hidden />
            <span>{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
