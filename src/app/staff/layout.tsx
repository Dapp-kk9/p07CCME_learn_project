import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('nurse', 'admin')
  const t = await getTranslations()
  const items = [
    { href: '/staff', label: t('nav.queue'), icon: 'queue' as const },
    { href: '/staff/resets', label: t('nav.resets'), icon: 'key' as const },
    ...(me.role === 'admin' ? [{ href: '/admin', label: t('nav.admin'), icon: 'dash' as const }] : []),
  ]
  return <AppShell me={me} items={items}>{children}</AppShell>
}
