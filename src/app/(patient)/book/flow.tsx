'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { bookAppointment, getSlots } from '@/actions/booking'
import { Alert, Badge, Button, Card, Empty, Field, Textarea } from '@/components/ui'
import { addDays, formatDate, formatTime, isoWeekday, weekdayName, type Locale } from '@/lib/date'
import type { ErrorCode } from '@/lib/errors'
import type { Clinic, DoctorListItem, Session, SlotRow } from '@/lib/types'

type Kw = { clinic_id: number; keyword_th: string; keyword_en: string }
type Props = {
  today: string
  daysAhead: number
  cancelMinHours: number
  clinics: Clinic[]
  sessions: Session[]
  doctors: DoctorListItem[]
  keywords: Kw[]
}

export function BookFlow({ today, daysAhead, cancelMinHours, clinics, sessions, doctors, keywords }: Props) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [clinicId, setClinicId] = useState<number | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotRow[] | null>(null)
  const [slotError, setSlotError] = useState<ErrorCode | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [pending, start] = useTransition()

  const name = (th: string, en: string | null) => (locale === 'en' && en ? en : th)
  const clinic = clinics.find((c) => c.id === clinicId)
  const doctor = doctors.find((d) => d.doctor_id === doctorId)
  const sessionName = (id: number) => {
    const s = sessions.find((x) => x.id === id)
    return s ? name(s.name, s.name_en) : ''
  }

  const suggested = useMemo(() => {
    const text = reason.toLowerCase()
    if (text.trim().length < 2) return new Set<number>()
    return new Set(
      keywords
        .filter((k) => text.includes(k.keyword_th.toLowerCase()) || text.includes(k.keyword_en.toLowerCase()))
        .map((k) => k.clinic_id),
    )
  }, [reason, keywords])

  const clinicDoctors = doctors.filter((d) => d.clinic_id === clinicId)

  const workDays = useMemo(() => new Set((doctor?.schedules ?? []).map((s) => s.weekday)), [doctor])
  const dates = useMemo(() => {
    if (!doctor) return []
    const out: string[] = []
    for (let i = 0; i <= daysAhead && out.length < 21; i++) {
      const d = addDays(today, i)
      if (workDays.has(isoWeekday(d))) out.push(d)
    }
    return out
  }, [doctor, daysAhead, today, workDays])

  useEffect(() => {
    if (!doctorId || !date) return
    let cancelled = false
    setSlots(null)
    setSlotError(null)
    setTime(null)
    getSlots(doctorId, date).then((r) => {
      if (cancelled) return
      if (r.ok) setSlots(r.data ?? [])
      else setSlotError(r.error)
    })
    return () => { cancelled = true }
  }, [doctorId, date])

  const slot = slots?.find((s) => s.slot_time === time)

  function submit() {
    if (!doctorId || !date || !time) return
    setError(null)
    start(async () => {
      const r = await bookAppointment({ doctorId, date, time, reason })
      if (r.ok) {
        router.push('/appointments?booked=1')
        router.refresh()
      } else {
        setError(r.error)
        if (r.error === 'SLOT_TAKEN' || r.error === 'TOO_LATE' || r.error === 'PATIENT_TIME_CONFLICT') {
          setTime(null)
          setStep(3)
          if (date) getSlots(doctorId, date).then((x) => x.ok && setSlots(x.data ?? []))
        }
      }
    })
  }

  const steps = [t('book.step1'), t('book.step2'), t('book.step3'), t('book.step4')]

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-1.5" aria-label={t('book.title')}>
        {steps.map((label, i) => {
          const n = i + 1
          const done = n < step
          return (
            <li key={label} aria-current={n === step ? 'step' : undefined}>
              <div className={clsx('h-1.5 rounded-full', n <= step ? 'bg-brand' : 'bg-line')} />
              <p className={clsx('mt-1.5 flex items-center gap-1 text-xs', n === step ? 'font-semibold text-ink' : 'text-muted')}>
                {done && <Check size={12} aria-hidden />}
                {label}
              </p>
            </li>
          )
        })}
      </ol>

      {error && <Alert>{t(`errors.${error}`)}</Alert>}

      {step === 1 && (
        <Card className="space-y-5">
          <Field label={t('book.reasonLabel')} hint={t('book.reasonHint')} htmlFor="reason">
            <Textarea id="reason" rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('book.reasonPlaceholder')} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">{t('book.chooseClinic')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {clinics.map((c) => {
                const on = c.id === clinicId
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setClinicId(c.id); setDoctorId(null); setDate(null); setTime(null) }}
                    className={clsx(
                      'flex min-h-12 items-center justify-between gap-2 rounded-md border px-3 text-left',
                      on ? 'border-brand bg-brand-soft font-medium' : 'border-line bg-card hover:bg-brand-soft/50',
                    )}
                  >
                    <span>{name(c.name, c.name_en)}</span>
                    {suggested.has(c.id) && <Badge tone="amber">{t('book.suggested')}</Badge>}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-muted">{t('book.disclaimer')}</p>
          <div className="flex justify-end">
            <Button disabled={!reason.trim() || !clinicId} onClick={() => setStep(2)}>{t('common.next')}</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('book.doctorsIn', { clinic: clinic ? name(clinic.name, clinic.name_en) : '' })}</p>
          {clinicDoctors.length === 0 ? (
            <Empty title={t('book.noDoctors')} />
          ) : (
            clinicDoctors.map((d) => (
              <button
                key={d.doctor_id}
                type="button"
                onClick={() => { setDoctorId(d.doctor_id); setDate(null); setTime(null); setStep(3) }}
                className={clsx('block w-full rounded-lg border bg-card p-4 text-left hover:bg-brand-soft/40', d.doctor_id === doctorId ? 'border-brand' : 'border-line')}
              >
                <p className="font-semibold">{name(d.full_name, d.full_name_en)}</p>
                <p className="text-sm text-muted">{t('book.room', { no: d.room_no })}</p>
                <ScheduleSummary d={d} sessions={sessions} locale={locale} />
              </button>
            ))
          )}
          <Button variant="ghost" onClick={() => setStep(1)}>{t('common.back')}</Button>
        </div>
      )}

      {step === 3 && doctor && (
        <div className="space-y-4">
          <Card>
            <p className="font-semibold">{name(doctor.full_name, doctor.full_name_en)}</p>
            <p className="text-sm text-muted">{clinic ? name(clinic.name, clinic.name_en) : ''} · {t('book.room', { no: doctor.room_no })}</p>
          </Card>

          <div>
            <p className="mb-2 text-sm font-medium">{t('book.chooseDate')}</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={d === date}
                  onClick={() => setDate(d)}
                  className={clsx(
                    'min-w-24 shrink-0 rounded-md border px-3 py-2 text-center',
                    d === date ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:bg-brand-soft/50',
                  )}
                >
                  <span className="block text-xs opacity-80">{weekdayName(isoWeekday(d), locale)}</span>
                  <span className="block text-sm font-medium">{formatDate(d, locale, 'short')}</span>
                </button>
              ))}
            </div>
          </div>

          {date && (
            <div>
              <p className="mb-2 text-sm font-medium">{t('book.chooseTime')}</p>
              {slotError && <Alert>{t(`errors.${slotError}`)}</Alert>}
              {!slots && !slotError && <p className="text-sm text-muted">{t('common.loading')}</p>}
              {slots && slots.length === 0 && <Empty title={t('book.noSlots')} />}
              {slots && sessions.map((s) => {
                const list = slots.filter((x) => x.session_id === s.id)
                if (list.length === 0) return null
                return (
                  <div key={s.id} className="mb-4">
                    <p className="mb-1.5 text-sm text-muted">{name(s.name, s.name_en)} ({formatTime(s.start_time)}–{formatTime(s.end_time)})</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {list.map((x) => {
                        const unavailable = x.is_taken || !x.is_bookable
                        const on = x.slot_time === time
                        return (
                          <button
                            key={x.slot_time}
                            type="button"
                            disabled={unavailable}
                            aria-pressed={on}
                            onClick={() => setTime(x.slot_time)}
                            className={clsx(
                              'min-h-11 rounded-md border text-sm tabular-nums',
                              unavailable && 'cursor-not-allowed border-transparent bg-paper text-muted/60 line-through',
                              !unavailable && !on && 'border-line bg-card hover:bg-brand-soft/60',
                              on && 'border-brand bg-brand font-medium text-white',
                            )}
                          >
                            {formatTime(x.slot_time)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-muted">{t('book.slotLegend', { hours: cancelMinHours })}</p>
              {slot && (
                <div className="mt-3"><Alert tone="brand">
                  {slot.queue_ahead === 0 ? t('book.queueNone') : t('book.queueBefore', { n: slot.queue_ahead })}
                </Alert></div>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>{t('common.back')}</Button>
            <Button disabled={!date || !time} onClick={() => setStep(4)}>{t('common.next')}</Button>
          </div>
        </div>
      )}

      {step === 4 && doctor && date && time && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t('book.confirmTitle')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
            <dt className="text-muted">{t('ticket.clinic')}</dt><dd>{clinic ? name(clinic.name, clinic.name_en) : ''} ({t('book.room', { no: doctor.room_no })})</dd>
            <dt className="text-muted">{t('ticket.doctor')}</dt><dd>{name(doctor.full_name, doctor.full_name_en)}</dd>
            <dt className="text-muted">{t('book.date')}</dt><dd>{formatDate(date, locale, 'long')}</dd>
            <dt className="text-muted">{t('book.time')}</dt><dd>{formatTime(time)} ({sessionName(slot?.session_id ?? 0)})</dd>
            <dt className="text-muted">{t('ticket.reason')}</dt><dd className="break-words">{reason}</dd>
            <dt className="text-muted">{t('ticket.queueAhead')}</dt><dd>{slot ? `${slot.queue_ahead} ${t('ticket.queueUnit')}` : '-'}</dd>
          </dl>
          <p className="text-xs text-muted">{t('book.cancelRule', { hours: cancelMinHours })}</p>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)} disabled={pending}>{t('common.back')}</Button>
            <Button onClick={submit} disabled={pending}>{pending ? t('common.loading') : t('book.confirm')}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function ScheduleSummary({ d, sessions, locale }: { d: DoctorListItem; sessions: Session[]; locale: Locale }) {
  return (
    <div className="mt-2 space-y-0.5 text-sm">
      {sessions.map((s) => {
        const days = d.schedules.filter((x) => x.session_id === s.id).map((x) => x.weekday)
        if (days.length === 0) return null
        return (
          <p key={s.id}>
            <span className="text-muted">{locale === 'en' ? s.name_en : s.name} {formatTime(s.start_time)}–{formatTime(s.end_time)}: </span>
            {days.map((w) => weekdayName(w, locale)).join(' ')}
          </p>
        )
      })}
    </div>
  )
}
