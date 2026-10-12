import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Alert, Button, PageTitle } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { getRef } from '@/lib/ref'
import { bangkokToday } from '@/lib/date'
import type { DoctorListItem } from '@/lib/types'
import { BookFlow } from './flow'

export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const ref = await getRef()
  const today = bangkokToday()

  const [{ data: doctors }, { data: keywords }, { count }] = await Promise.all([
    supabase.rpc('list_doctors', {}),
    supabase.from('symptom_keywords').select('clinic_id, keyword_th, keyword_en'),
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['booked', 'checked_in'])
      .gte('appointment_date', today),
  ])

  if ((count ?? 0) >= ref.settings.max_active_appointments) {
    return (
      <>
        <PageTitle title={t('book.title')} />
        <Alert tone="amber">{t('home.limit', { max: ref.settings.max_active_appointments })}</Alert>
        <div className="mt-4"><Link href="/appointments"><Button variant="secondary">{t('nav.appointments')}</Button></Link></div>
      </>
    )
  }

  return (
    <>
      <PageTitle title={t('book.title')} />
      <BookFlow
        today={today}
        daysAhead={ref.settings.booking_days_ahead}
        cancelMinHours={ref.settings.cancel_min_hours}
        clinics={ref.clinics}
        sessions={ref.sessions}
        doctors={(doctors ?? []) as DoctorListItem[]}
        keywords={keywords ?? []}
      />
    </>
  )
}
