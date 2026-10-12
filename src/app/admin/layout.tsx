import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('admin')
  const t = await getTranslations()
  return (
    <AppShell
      me={me}
      items={[
        { href: '/admin', label: t('nav.overview'), icon: 'dash' },
        { href: '/admin/doctors', label: t('nav.doctors'), icon: 'doctors' },
        { href: '/admin/staff', label: t('nav.staff'), icon: 'staff' },
        { href: '/admin/appointments', label: t('nav.allAppointments'), icon: 'list' },
        { href: '/admin/settings', label: t('nav.settings'), icon: 'settings' },
        { href: '/staff', label: t('nav.queue'), icon: 'queue' },
      ]}
    >
      {children}
    </AppShell>
  )
}
