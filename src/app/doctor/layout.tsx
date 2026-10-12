import { getTranslations } from 'next-intl/server'
import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth'

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('doctor')
  const t = await getTranslations()
  return <AppShell me={me} items={[
        { href: '/doctor', label: t('nav.myQueue'), icon: 'queue' },
        { href: '/doctor/schedule', label: t('nav.mySchedule'), icon: 'list' },
      ]}>{children}</AppShell>
}
