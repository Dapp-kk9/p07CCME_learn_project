'use client'
import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import clsx from 'clsx'
import { setDoctorActive, setDoctorRoom, setSchedule } from '@/actions/admin'
import { Alert, Button, Select } from '@/components/ui'
import { weekdayName, type Locale } from '@/lib/date'
import type { Room, Session } from '@/lib/types'

export function DoctorControls({
  doctorId, isActive, roomId, rooms, sessions, schedule,
}: { doctorId: string; userId: string; isActive: boolean; roomId: number; rooms: Room[]; sessions: Session[]; schedule: string[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [on, setOn] = useState(new Set(schedule))
  const [room, setRoom] = useState(roomId)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) { setErr(null); after?.() } else setErr(t(`errors.${r.error}`))
    })

  return (
    <div className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="pr-3 text-left font-normal text-muted"></th>
              {[1, 2, 3, 4, 5, 6, 7].map((w) => <th key={w} className="px-1 pb-1 text-center font-normal text-muted">{weekdayName(w, locale)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="pr-3 text-muted">{locale === 'en' ? s.name_en : s.name}</td>
                {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                  const key = `${w}-${s.id}`
                  const checked = on.has(key)
                  return (
                    <td key={w} className="p-0.5">
                      <button
                        type="button"
                        aria-pressed={checked}
                        aria-label={`${weekdayName(w, locale, 'long')} ${locale === 'en' ? s.name_en : s.name}`}
                        disabled={pending}
                        onClick={() => run(() => setSchedule(doctorId, w, s.id, !checked), () => {
                          const next = new Set(on)
                          checked ? next.delete(key) : next.add(key)
                          setOn(next)
                        })}
                        className={clsx('size-9 rounded-md border', checked ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:bg-brand-soft')}
                      >
                        {checked ? '✓' : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={room} onChange={(e) => setRoom(Number(e.target.value))} className="min-h-9 w-40 text-sm" aria-label={t('admin.room')}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{t('book.room', { no: r.room_no })}</option>)}
        </Select>
        <Button size="sm" variant="secondary" disabled={pending || room === roomId} onClick={() => run(() => setDoctorRoom(doctorId, room))}>{t('admin.changeRoom')}</Button>
        <Button size="sm" variant={isActive ? 'danger' : 'primary'} disabled={pending} onClick={() => run(() => setDoctorActive(doctorId, !isActive))}>
          {isActive ? t('admin.deactivate') : t('admin.activate')}
        </Button>
      </div>
    </div>
  )
}
