import { getTranslations } from 'next-intl/server'
import { LogOut } from 'lucide-react'
import { logout } from '@/actions/auth'
import { LangSwitch } from '@/components/lang-switch'
import { NavLinks, type NavItem } from '@/components/nav'
import type { Me } from '@/lib/auth'

export async function AppShell({ me, items, children }: { me: Me; items: NavItem[]; children: React.ReactNode }) {
  const t = await getTranslations()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-line bg-card md:flex md:flex-col md:justify-between md:p-4">
        <div className="space-y-6">
          <div>
            <p className="text-lg font-semibold text-brand-dark">{t('app.name')}</p>
            <p className="text-xs text-muted">{t(`roles.${me.role}`)}</p>
          </div>
          <NavLinks items={items} variant="side" />
        </div>
        <div className="space-y-3">
          <p className="truncate text-sm text-muted" title={me.email}>{me.fullName}</p>
          <LangSwitch />
          <form action={logout}>
            <button className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-danger-soft hover:text-danger">
              <LogOut size={16} aria-hidden /> {t('nav.logout')}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-2 md:hidden">
          <span className="font-semibold text-brand-dark">{t('app.name')}</span>
          <div className="flex items-center gap-2">
            <LangSwitch />
            <form action={logout}>
              <button aria-label={t('nav.logout')} className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger">
                <LogOut size={18} aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
          <NavLinks items={items} variant="bottom" />
        </div>
      </div>
    </div>
  )
}
