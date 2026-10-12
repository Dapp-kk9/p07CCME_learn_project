'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { cancelByStaff, saveHn, setStatus } from '@/actions/queue'
import { Button, Input } from '@/components/ui'
import type { ApptStatus } from '@/lib/types'

export function RowActions({ id, patientId, hn, status, started }: { id: string; patientId: string; hn: string | null; status: ApptStatus; started: boolean }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [hnVal, setHnVal] = useState(hn ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn()
      setErr(r.ok ? null : t(`errors.${r.error}`))
      setConfirmCancel(false)
    })

  const open = status === 'booked' || status === 'checked_in'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'booked' && <Button size="sm" disabled={pending} onClick={() => run(() => setStatus(id, 'checked_in'))}>{t('staff.checkIn')}</Button>}
        {status === 'booked' && started && <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setStatus(id, 'no_show'))}>{t('staff.noShow')}</Button>}
        {open && !confirmCancel && <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirmCancel(true)}>{t('staff.cancel')}</Button>}
        {open && confirmCancel && (
          <>
            <span className="text-sm">{t('staff.cancelAsk')}</span>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => cancelByStaff(id, 'เจ้าหน้าที่ยกเลิก'))}>{t('ticket.cancelYes')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>{t('common.back')}</Button>
          </>
        )}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); run(() => saveHn(patientId, hnVal)) }}
        >
          <label className="text-sm text-muted" htmlFor={`hn-${id}`}>HN</label>
          <Input id={`hn-${id}`} value={hnVal} onChange={(e) => setHnVal(e.target.value)} className="min-h-9 w-32 text-sm" maxLength={30} />
          <Button size="sm" variant="secondary" type="submit" disabled={pending || !hnVal.trim() || hnVal.trim() === hn}>{t('common.save')}</Button>
        </form>
      </div>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </div>
  )
}
