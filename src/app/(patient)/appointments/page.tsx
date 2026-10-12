import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AppointmentTicket } from '@/components/appointment-ticket'
import { Alert, Empty, PageTitle } from '@/components/ui'
import { getRef } from '@/lib/ref'
import { loadMyAppointments } from '@/lib/appointments'
import { bangkokToday } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  const t = await getTranslations()
  const { booked } = await searchParams
  const ref = await getRef()
  const all = await loadMyAppointments({ scope: 'all' })
  const today = bangkokToday()
  const upcoming = all.filter((a) => (a.status === 'booked' || a.status === 'checked_in') && a.date >= today).reverse()
  const history = all.filter((a) => !upcoming.includes(a))

  return (
    <>
      <PageTitle title={t('appointments.title')} />
      {booked && <div className="mb-4"><Alert tone="ok">{t('appointments.booked')}</Alert></div>}
      <h2 className="mb-2 font-medium">{t('appointments.upcoming')}</h2>
      {upcoming.length === 0 ? (
        <Empty title={t('home.emptyTitle')} action={<Link className="text-brand hover:underline" href="/book">{t('home.bookNew')}</Link>} />
      ) : (
        <div className="space-y-3">
          {upcoming.map((a) => <AppointmentTicket key={a.id} a={a} cancelMinHours={ref.settings.cancel_min_hours} canCancelHere />)}
        </div>
      )}
      <h2 className="mb-2 mt-8 font-medium">{t('appointments.history')}</h2>
      {history.length === 0 ? (
        <Empty title={t('appointments.noHistory')} />
      ) : (
        <div className="space-y-3">
          {history.map((a) => <AppointmentTicket key={a.id} a={a} cancelMinHours={ref.settings.cancel_min_hours} canCancelHere={false} />)}
        </div>
      )}
    </>
  )
}
