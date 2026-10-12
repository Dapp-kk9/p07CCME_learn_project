import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Alert, Card, PageTitle } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getRef, pick } from '@/lib/ref'
import { bangkokToday, type Locale } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const supabase = await createClient()
  const ref = await getRef()
  const today = bangkokToday()

  const [{ data: upcoming }, { data: resets }] = await Promise.all([
    supabase.from('appointments').select('clinic_id, appointment_date, status').gte('appointment_date', today).limit(5000),
    supabase.rpc('list_reset_requests'),
  ])
  const pendingResets = (resets ?? []).filter((r: { status: string }) => r.status === 'pending').length

  const rows = ref.clinics.map((c) => {
    const mine = (upcoming ?? []).filter((a) => a.clinic_id === c.id)
    return {
      clinic: pick(locale, c.name, c.name_en),
      today: mine.filter((a) => a.appointment_date === today && a.status !== 'cancelled').length,
      upcoming: mine.filter((a) => a.status === 'booked' || a.status === 'checked_in').length,
      doctors: ref.doctors.filter((d) => d.clinic_id === c.id).length,
    }
  })

  return (
    <>
      <PageTitle title={t('admin.title')} sub={t('admin.sub')} />
      {pendingResets > 0 && (
        <div className="mb-4">
          <Alert tone="amber">
            {t('staff.pendingResets', { n: pendingResets })} <Link href="/staff/resets" className="font-medium underline">{t('nav.resets')}</Link>
          </Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.clinic}>
            <p className="font-semibold">{r.clinic}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-2xl font-semibold tabular-nums">{r.today}</p><p className="text-xs text-muted">{t('admin.today')}</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{r.upcoming}</p><p className="text-xs text-muted">{t('admin.upcoming')}</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{r.doctors}</p><p className="text-xs text-muted">{t('admin.doctorsCount')}</p></div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
