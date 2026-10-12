import { getLocale, getTranslations } from 'next-intl/server'
import { DateNav } from '@/components/date-nav'
import { Card, Empty, PageTitle } from '@/components/ui'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getMe } from '@/lib/auth'
import { getRef, pick } from '@/lib/ref'
import { formatTime, type Locale } from '@/lib/date'
import { loadQueue, resolveDate } from '@/lib/queue'
import { CompleteButton } from './complete'

export const dynamic = 'force-dynamic'

export default async function DoctorPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const { date, today } = resolveDate((await searchParams).date)
  const supabase = await createClient()
  const user = await getMe()
  // นโยบาย RLS ให้แพทย์เห็นแพทย์ทุกคน จึงต้องกรอง user_id เอง
  const { data: me } = await supabase
    .from('doctors')
    .select('id, full_name, full_name_en, room_id, clinic_id')
    .eq('user_id', user?.id ?? '')
    .maybeSingle()
  const ref = await getRef()

  if (!me) return <Empty title={t('doctor.noProfile')} />

  const rows = await loadQueue(date, { doctorId: me.id })
  const room = ref.roomById.get(me.room_id)
  const clinic = ref.clinicById.get(me.clinic_id)
  const active = rows.filter((r) => r.status !== 'no_show')

  return (
    <>
      <PageTitle
        title={t('doctor.title')}
        sub={`${pick(locale, me.full_name, me.full_name_en)} · ${clinic ? pick(locale, clinic.name, clinic.name_en) : ''} · ${t('book.room', { no: room?.room_no ?? 0 })}`}
        right={<DateNav date={date} today={today} />}
      />
      <Card className="mb-5 flex items-baseline gap-3">
        <span className="text-4xl font-semibold tabular-nums">{active.length}</span>
        <span className="text-muted">{t('doctor.totalToday')}</span>
      </Card>

      {rows.length === 0 ? (
        <Empty title={t('doctor.empty')} />
      ) : (
        ref.sessions.map((s) => {
          const list = rows.filter((r) => r.session_id === s.id)
          if (list.length === 0) return null
          return (
            <section key={s.id} className="mb-6">
              <h2 className="mb-2 font-medium">
                {pick(locale, s.name, s.name_en)} <span className="font-normal text-muted">({t('doctor.count', { n: list.filter((r) => r.status !== 'no_show').length })})</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                {list.map((r) => (
                  <li key={r.appointment_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                    <span className="w-14 text-lg font-semibold tabular-nums">{formatTime(r.appointment_time)}</span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-medium">{r.patient_name} {r.hn && <span className="text-sm font-normal text-muted">HN {r.hn}</span>}</p>
                      <p className="break-words text-sm text-muted">{r.reason}</p>
                    </div>
                    <StatusBadge status={r.status} />
                    {r.status === 'checked_in' && <CompleteButton id={r.appointment_id} />}
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
