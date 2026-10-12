'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { updateProfile } from '@/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'

export function ProfileForm(p: { fullName: string; phone: string; birthDate: string; hn: string | null }) {
  const t = useTranslations()
  const [state, action, pending] = useActionState(updateProfile, null)
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      {state?.ok && <Alert tone="ok">{t('profile.saved')}</Alert>}
      <Field label={t('profile.hn')} hint={p.hn ? undefined : t('profile.hnHint')}>
        <p className="min-h-11 rounded-md bg-paper px-3 py-2.5 text-[15px]">{p.hn ?? t('profile.hnNone')}</p>
      </Field>
      <Field label={t('auth.fullName')} htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={p.fullName} required minLength={2} maxLength={200} />
      </Field>
      <Field label={t('auth.phone')} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={p.phone} required pattern="[0-9+\- ]{9,15}" />
      </Field>
      <Field label={t('auth.birthDate')} htmlFor="birthDate">
        <Input id="birthDate" name="birthDate" type="date" defaultValue={p.birthDate} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? t('common.loading') : t('common.save')}</Button>
    </form>
  )
}
