import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AppointmentTicket } from '@/components/appointment-ticket'
import { Alert, Button, Empty, PageTitle } from '@/components/ui'
import { getMe } from '@/lib/auth'
import { getRef } from '@/lib/ref'
import { loadMyAppointments } from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export default async function PatientHome() {
  const t = await getTranslations()
  const me = await getMe()
  const ref = await getRef()
  const list = await loadMyAppointments({ scope: 'upcoming' })
  const atLimit = list.length >= ref.settings.max_active_appointments

  return (
    <>
      <PageTitle
        title={t('home.greeting', { name: me?.fullName ?? '' })}
        sub={t('home.upcoming')}
        right={!atLimit && <Link href="/book"><Button>{t('home.bookNew')}</Button></Link>}
      />
      {atLimit && <div className="mb-4"><Alert tone="amber">{t('home.limit', { max: ref.settings.max_active_appointments })}</Alert></div>}
      {list.length === 0 ? (
        <Empty
          title={t('home.emptyTitle')}
          hint={t('home.emptyHint')}
          action={<Link href="/book"><Button>{t('home.bookNew')}</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <AppointmentTicket key={a.id} a={a} cancelMinHours={ref.settings.cancel_min_hours} canCancelHere />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{t('app.emergency')}</p>
    </>
  )
}
