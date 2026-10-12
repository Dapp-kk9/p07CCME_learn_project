import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('patient')
  const t = await getTranslations()
  return (
    <AppShell
      me={me}
      items={[
        { href: '/', label: t('nav.home'), icon: 'home' },
        { href: '/book', label: t('nav.book'), icon: 'book' },
        { href: '/appointments', label: t('nav.appointments'), icon: 'list' },
        { href: '/profile', label: t('nav.profile'), icon: 'user' },
      ]}
    >
      {children}
    </AppShell>
  )
}
