import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { DateNav } from '@/components/date-nav'
import { Alert, Empty, PageTitle } from '@/components/ui'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getMe } from '@/lib/auth'
import { getRef, pick } from '@/lib/ref'
import { formatTime, minutesUntil, type Locale } from '@/lib/date'
import { loadQueue, resolveDate } from '@/lib/queue'
import { RowActions } from './row-actions'

export const dynamic = 'force-dynamic'

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ date?: string; clinic?: string; room?: string }> }) {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const sp = await searchParams
  const { date, today } = resolveDate(sp.date)
  const me = await getMe()
  const ref = await getRef()
  const supabase = await createClient()

  let myClinicIds: number[]
  if (me?.role === 'admin') myClinicIds = ref.clinics.map((c) => c.id)
  else {
    const { data } = await supabase.from('clinic_staff').select('clinic_id')
    myClinicIds = (data ?? []).map((r) => r.clinic_id as number)
  }
  if (myClinicIds.length === 0) return <Empty title={t('staff.noClinic')} hint={t('staff.noClinicHint')} />

  const clinicId = sp.clinic && myClinicIds.includes(Number(sp.clinic)) ? Number(sp.clinic) : myClinicIds[0]
  const clinic = ref.clinicById.get(clinicId)
  const rooms = ref.rooms.filter((r) => r.clinic_id === clinicId).sort((a, b) => a.room_no - b.room_no)
  const roomId = sp.room && rooms.some((r) => r.id === Number(sp.room)) ? Number(sp.room) : null

  const [rows, { data: resets }] = await Promise.all([
    loadQueue(date, { clinicIds: [clinicId] }),
    supabase.rpc('list_reset_requests'),
  ])
  const pendingResets = (resets ?? []).filter((r: { status: string }) => r.status === 'pending').length
  const shown = rows.filter((r) => !roomId || r.room_id === roomId)

  const q = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams({ date, clinic: String(clinicId), ...(roomId ? { room: String(roomId) } : {}) })
    for (const [k, v] of Object.entries(over)) v === null ? p.delete(k) : p.set(k, String(v))
    return `/staff?${p.toString()}`
  }
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${on ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:bg-brand-soft/60'}`

  return (
    <>
      <PageTitle title={t('staff.title')} sub={clinic ? pick(locale, clinic.name, clinic.name_en) : ''} right={<DateNav date={date} today={today} />} />
      {pendingResets > 0 && (
        <div className="mb-4">
          <Alert tone="amber">
            {t('staff.pendingResets', { n: pendingResets })}{' '}
            <Link href="/staff/resets" className="font-medium underline">{t('nav.resets')}</Link>
          </Alert>
        </div>
      )}

      {myClinicIds.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label={t('staff.clinic')}>
          {myClinicIds.map((id) => {
            const c = ref.clinicById.get(id)
            return c && <Link key={id} href={q({ clinic: id, room: null })} className={chip(id === clinicId)}>{pick(locale, c.name, c.name_en)}</Link>
          })}
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-2" aria-label={t('staff.room')}>
        <Link href={q({ room: null })} className={chip(!roomId)}>{t('staff.allRooms')}</Link>
        {rooms.map((r) => <Link key={r.id} href={q({ room: r.id })} className={chip(r.id === roomId)}>{t('book.room', { no: r.room_no })}</Link>)}
      </div>

      {shown.length === 0 ? (
        <Empty title={t('staff.empty')} />
      ) : (
        rooms.filter((r) => !roomId || r.id === roomId).map((room) => {
          const list = shown.filter((r) => r.room_id === room.id)
          if (list.length === 0) return null
          const doc = ref.doctorById.get(list[0].doctor_id)
          return (
            <section key={room.id} className="mb-6">
              <h2 className="mb-2 font-medium">
                {t('book.room', { no: room.room_no })} <span className="font-normal text-muted">· {doc ? pick(locale, doc.full_name, doc.full_name_en) : ''} · {t('doctor.count', { n: list.filter((r) => r.status !== 'no_show').length })}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                {list.map((r) => (
                  <li key={r.appointment_id} className="space-y-2 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="w-14 text-lg font-semibold tabular-nums">{formatTime(r.appointment_time)}</span>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-medium">{r.patient_name}</p>
                        <p className="break-words text-sm text-muted">{r.reason}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <RowActions
                      id={r.appointment_id}
                      patientId={r.patient_id}
                      hn={r.hn}
                      status={r.status}
                      started={minutesUntil(date, r.appointment_time) <= 0}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </>
  )
}
