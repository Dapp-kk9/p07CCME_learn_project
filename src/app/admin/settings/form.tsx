'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { saveSettings } from '@/actions/admin'
import { Alert, Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'
import type { Settings } from '@/lib/types'

export function SettingsForm({ s }: { s: Settings }) {
  const t = useTranslations()
  const [state, action, pending] = useActionState(saveSettings, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormError state={state} />{state?.ok && <Alert tone="ok">{t('profile.saved')}</Alert>}</div>
      <Field label={t('admin.slotMinutes')} hint={t('admin.slotHint')} htmlFor="s1"><Input id="s1" name="slot_minutes" type="number" min={5} max={120} defaultValue={s.slot_minutes} required /></Field>
      <Field label={t('admin.maxActive')} htmlFor="s2"><Input id="s2" name="max_active_appointments" type="number" min={1} max={20} defaultValue={s.max_active_appointments} required /></Field>
      <Field label={t('admin.cancelHours')} htmlFor="s3"><Input id="s3" name="cancel_min_hours" type="number" min={0} max={72} defaultValue={s.cancel_min_hours} required /></Field>
      <Field label={t('admin.daysAhead')} htmlFor="s4"><Input id="s4" name="booking_days_ahead" type="number" min={1} max={365} defaultValue={s.booking_days_ahead} required /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('common.save')}</Button></div>
    </form>
  )
}
