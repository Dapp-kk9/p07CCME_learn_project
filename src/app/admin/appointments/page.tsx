import { getLocale, getTranslations } from 'next-intl/server'
import { DateNav } from '@/components/date-nav'
import { Empty, PageTitle } from '@/components/ui'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getRef, pick } from '@/lib/ref'
import { formatTime, type Locale } from '@/lib/date'
import { resolveDate } from '@/lib/queue'
import { RowActions } from '@/app/staff/row-actions'
import type { ApptStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminAppointments({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const { date, today } = resolveDate((await searchParams).date)
  const supabase = await createClient()
  const ref = await getRef()
  const { data } = await supabase
    .from('appointments')
    .select('id, clinic_id, doctor_id, room_id, appointment_time, reason, status, patient_id, patients(full_name, hn)')
    .eq('appointment_date', date)
    .order('clinic_id')
    .order('appointment_time')
    .limit(500)
  const rows = (data ?? []) as unknown as Array<{
    id: string; clinic_id: number; doctor_id: string; room_id: number; appointment_time: string; reason: string
    status: ApptStatus; patient_id: string; patients: { full_name: string; hn: string | null } | null
  }>

  return (
    <>
      <PageTitle title={t('admin.allAppointments')} right={<DateNav date={date} today={today} />} />
      {rows.length === 0 ? <Empty title={t('staff.empty')} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
          {rows.map((r) => {
            const c = ref.clinicById.get(r.clinic_id)
            const d = ref.doctorById.get(r.doctor_id)
            const room = ref.roomById.get(r.room_id)
            return (
              <li key={r.id} className="space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-14 text-lg font-semibold tabular-nums">{formatTime(r.appointment_time)}</span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-medium">{r.patients?.full_name ?? '-'}</p>
                    <p className="text-sm text-muted">
                      {c ? pick(locale, c.name, c.name_en) : ''} · {t('book.room', { no: room?.room_no ?? 0 })} · {d ? pick(locale, d.full_name, d.full_name_en) : ''}
                    </p>
                    <p className="break-words text-sm text-muted">{r.reason}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <RowActions id={r.id} patientId={r.patient_id} hn={r.patients?.hn ?? null} status={r.status} started />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
