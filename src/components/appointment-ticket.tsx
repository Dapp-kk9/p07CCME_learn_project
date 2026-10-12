'use client'
import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cancelMyAppointment } from '@/actions/booking'
import { Alert, Badge, Button } from '@/components/ui'
import { formatDate, formatTime, minutesUntil, type Locale } from '@/lib/date'
import type { ApptStatus } from '@/lib/types'
import type { ErrorCode } from '@/lib/errors'

export type TicketData = {
  id: string
  date: string
  time: string
  status: ApptStatus
  reason: string
  clinic: string
  doctor: string
  room: string
  session: string
  queueAhead: number | null
}

const TONE: Record<ApptStatus, 'brand' | 'ok' | 'neutral' | 'danger' | 'amber'> = {
  booked: 'brand', checked_in: 'amber', completed: 'ok', cancelled: 'neutral', no_show: 'danger',
}

export function AppointmentTicket({ a, cancelMinHours, canCancelHere }: { a: TicketData; cancelMinHours: number; canCancelHere: boolean }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [pending, start] = useTransition()

  const active = a.status === 'booked' || a.status === 'checked_in'
  const tooLate = minutesUntil(a.date, a.time) < cancelMinHours * 60
  const canCancel = canCancelHere && a.status === 'booked' && !tooLate

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-card sm:grid sm:grid-cols-[9.5rem_1fr]">
      <div className={`flex items-center justify-between gap-2 px-4 py-3 sm:flex-col sm:justify-center sm:border-r sm:border-dashed sm:border-line sm:text-center ${active ? 'bg-brand-soft' : 'bg-paper'}`}>
        {active && a.queueAhead !== null ? (
          <>
            <p className="order-2 text-sm text-brand-dark sm:order-1">{t('ticket.queueAhead')}</p>
            <p className="order-1 text-4xl font-semibold leading-none tabular-nums text-brand-dark sm:order-2 sm:my-1 sm:text-5xl">{a.queueAhead}</p>
            <p className="order-3 hidden text-sm text-brand-dark sm:block">{t('ticket.queueUnit')}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{formatTime(a.time)}</p>
            <Badge tone={TONE[a.status]}>{t(`status.${a.status}`)}</Badge>
          </>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{formatDate(a.date, locale, 'long')}</p>
            <p className="text-sm text-muted">{formatTime(a.time)} · {a.session}</p>
          </div>
          {active && <Badge tone={TONE[a.status]}>{t(`status.${a.status}`)}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-muted">{t('ticket.doctor')}</dt><dd>{a.doctor}</dd>
          <dt className="text-muted">{t('ticket.clinic')}</dt><dd>{a.clinic} ({a.room})</dd>
          <dt className="text-muted">{t('ticket.reason')}</dt><dd className="break-words">{a.reason}</dd>
        </dl>

        {error && <Alert>{t(`errors.${error}`)}</Alert>}
        {canCancelHere && a.status === 'booked' && (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{t('ticket.cancelAsk')}</span>
              <Button
                size="sm" variant="danger" disabled={pending}
                onClick={() => start(async () => {
                  const r = await cancelMyAppointment(a.id)
                  if (!r.ok) { setError(r.error); setConfirming(false) }
                })}
              >
                {t('ticket.cancelYes')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t('common.back')}</Button>
            </div>
          ) : canCancel ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>{t('ticket.cancel')}</Button>
          ) : (
            <p className="text-xs text-muted">{t('ticket.cannotCancel', { hours: cancelMinHours })}</p>
          )
        )}
      </div>
    </article>
  )
}
