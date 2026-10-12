'use client'
import { useActionState, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createStaffAccount } from '@/actions/admin'
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui'
import { FormError } from '@/components/form-error'
import type { Clinic, Room } from '@/lib/types'

export function CreateStaffForm({ kind, clinics, rooms }: { kind: 'doctor' | 'nurse'; clinics: Clinic[]; rooms: Room[] }) {
  const t = useTranslations()
  const locale = useLocale()
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? 0)
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof createStaffAccount>[0], fd: FormData) => {
    const r = await createStaffAccount(prev, fd)
    if (r.ok) formRef.current?.reset()
    return r
  }, null)

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>{kind === 'doctor' ? t('admin.addDoctor') : t('admin.addStaff')}</Button>
  return (
    <Card>
      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="kind" value={kind} />
        <div className="sm:col-span-2"><FormError state={state} />{state?.ok && <Alert tone="ok">{t('admin.created')}</Alert>}</div>
        <Field label={t('auth.fullName')} htmlFor="c-name"><Input id="c-name" name="fullName" required minLength={2} /></Field>
        {kind === 'doctor'
          ? <Field label={t('admin.nameEn')} htmlFor="c-nameen"><Input id="c-nameen" name="fullNameEn" /></Field>
          : <Field label={t('auth.phone')} htmlFor="c-phone"><Input id="c-phone" name="phone" type="tel" /></Field>}
        <Field label={t('auth.email')} htmlFor="c-email"><Input id="c-email" name="email" type="email" required /></Field>
        <Field label={t('admin.initialPassword')} hint={t('admin.initialHint')} htmlFor="c-pw"><Input id="c-pw" name="password" required minLength={8} maxLength={72} autoComplete="off" /></Field>
        <Field label={t('ticket.clinic')} htmlFor="c-clinic">
          <Select id="c-clinic" name="clinicId" value={clinicId} onChange={(e) => setClinicId(Number(e.target.value))}>
            {clinics.map((c) => <option key={c.id} value={c.id}>{locale === 'en' ? c.name_en : c.name}</option>)}
          </Select>
        </Field>
        {kind === 'doctor' && (
          <Field label={t('admin.room')} htmlFor="c-room">
            <Select id="c-room" name="roomId" key={clinicId}>
              {rooms.filter((r) => r.clinic_id === clinicId).map((r) => <option key={r.id} value={r.id}>{t('book.room', { no: r.room_no })}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('admin.create')}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('common.back')}</Button>
        </div>
      </form>
    </Card>
  )
}
