import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Card, Empty, PageTitle } from '@/components/ui'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getMe } from '@/lib/auth'
import { getRef, pick } from '@/lib/ref'
import { addDays, formatDate, formatTime, isoWeekday, type Locale } from '@/lib/date'
import { loadQueueRange, resolveDate } from '@/lib/queue'

export const dynamic = 'force-dynamic'

const RANGES = [7, 14, 30]

export default async function DoctorSchedulePage({ searchParams }: { searchParams: Promise<{ from?: string; days?: string }> }) {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const sp = await searchParams
  const { date: from, today } = resolveDate(sp.from)
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 14
  const to = addDays(from, days - 1)

  const user = await getMe()
  const supabase = await createClient()
  const ref = await getRef()
  const { data: me } = await supabase.from('doctors').select('id').eq('user_id', user?.id ?? '').maybeSingle()
  if (!me) return <Empty title={t('doctor.noProfile')} />

  const [rows, { data: scheds }, { data: exc }] = await Promise.all([
    loadQueueRange(from, to, me.id),
    supabase.from('doctor_schedules').select('weekday, session_id').eq('doctor_id', me.id),
    supabase.from('schedule_exceptions').select('date, session_id').eq('doctor_id', me.id).gte('date', from).lte('date', to),
  ])

  const slotsPer = (sid: number) => {
    const s = ref.sessionById.get(sid)
    if (!s) return 0
    const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5))
    return Math.floor((toMin(s.end_time) - toMin(s.start_time)) / ref.settings.slot_minutes)
  }

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const worksOn = (d: string, sid: number) =>
    (scheds ?? []).some((s) => s.weekday === isoWeekday(d) && s.session_id === sid) &&
    !(exc ?? []).some((e) => e.date === d && (e.session_id === null || e.session_id === sid))

  const counted = rows.filter((r) => r.status !== 'no_show')
  const total = counted.length
  const busiest = dates
    .map((d) => ({ d, n: counted.filter((r) => r.appointment_date === d).length }))
    .sort((a, b) => b.n - a.n)[0]
  const workDays = dates.filter((d) => ref.sessions.some((s) => worksOn(d, s.id))).length

  const link = (over: { from?: string; days?: number }) => `/doctor/schedule?from=${over.from ?? from}&days=${over.days ?? days}`
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${on ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:bg-brand-soft/60'}`

  return (
    <>
      <PageTitle
        title={t('schedule.title')}
        sub={`${formatDate(from, locale, 'short')} – ${formatDate(to, locale, 'short')}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((n) => <Link key={n} href={link({ days: n })} className={chip(n === days)}>{t('schedule.nDays', { n })}</Link>)}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Link href={link({ from: addDays(from, -days) })} className={chip(false)}>{t('schedule.prev')}</Link>
        {from !== today && <Link href={link({ from: today })} className={chip(false)}>{t('common.today')}</Link>}
        <Link href={link({ from: addDays(from, days) })} className={chip(false)}>{t('schedule.next')}</Link>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card><p className="text-2xl font-semibold tabular-nums">{total}</p><p className="text-xs text-muted">{t('schedule.totalPatients')}</p></Card>
        <Card><p className="text-2xl font-semibold tabular-nums">{workDays}</p><p className="text-xs text-muted">{t('schedule.workDays')}</p></Card>
        <Card>
          <p className="text-2xl font-semibold tabular-nums">{busiest && busiest.n > 0 ? busiest.n : '-'}</p>
          <p className="text-xs text-muted">{busiest && busiest.n > 0 ? t('schedule.busiest', { date: formatDate(busiest.d, locale, 'weekday') }) : t('schedule.busiestNone')}</p>
        </Card>
      </div>

      <ul className="space-y-2">
        {dates.map((d) => {
          const dayRows = rows.filter((r) => r.appointment_date === d)
          const works = ref.sessions.filter((s) => worksOn(d, s.id))
          const n = dayRows.filter((r) => r.status !== 'no_show').length
          const off = works.length === 0
          return (
            <li key={d}>
              <details className="rounded-lg border border-line bg-card open:shadow-sm" open={d === today && n > 0}>
                <summary className={`flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4 ${off ? 'opacity-60' : ''}`}>
                  <div className="w-36 shrink-0">
                    <p className="font-medium">{formatDate(d, locale, 'weekday')}</p>
                    {d === today && <p className="text-xs text-brand">{t('common.today')}</p>}
                  </div>
                  {off ? (
                    <p className="text-sm text-muted">{t('schedule.off')}</p>
                  ) : (
                    <div className="grid min-w-0 flex-1 basis-60 gap-1.5">
                      {works.map((s) => {
                        const cnt = dayRows.filter((r) => r.session_id === s.id && r.status !== 'no_show').length
                        const cap = slotsPer(s.id)
                        const pct = cap ? Math.min(100, Math.round((cnt / cap) * 100)) : 0
                        return (
                          <div key={s.id} className="flex items-center gap-2 text-sm">
                            <span className="w-14 shrink-0 text-muted">{pick(locale, s.name, s.name_en)}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper" aria-hidden>
                              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-14 shrink-0 text-right tabular-nums">{cnt}/{cap}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <span className="w-16 shrink-0 text-right text-lg font-semibold tabular-nums">{off ? '' : n}</span>
                </summary>
                <div className="border-t border-line px-3 py-2 sm:px-4">
                  {dayRows.length === 0 ? (
                    <p className="py-2 text-sm text-muted">{t('doctor.empty')}</p>
                  ) : (
                    <>
                      <ul className="divide-y divide-line">
                        {dayRows.map((r) => (
                          <li key={r.appointment_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                            <span className="w-12 font-semibold tabular-nums">{formatTime(r.appointment_time)}</span>
                            <span className="min-w-0 flex-1 basis-44">
                              <span className="font-medium">{r.patient_name}</span>
                              <span className="block break-words text-muted">{r.reason}</span>
                            </span>
                            <StatusBadge status={r.status} />
                          </li>
                        ))}
                      </ul>
                      <p className="py-2"><Link href={`/doctor?date=${d}`} className="text-sm text-brand hover:underline">{t('schedule.openDay')}</Link></p>
                    </>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </>
  )
}
