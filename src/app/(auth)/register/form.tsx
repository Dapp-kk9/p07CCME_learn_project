'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { register } from '@/actions/auth'
import { Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'

export function RegisterForm() {
  const t = useTranslations()
  const [state, action, pending] = useActionState(register, null)
  const today = new Date().toISOString().slice(0, 10)
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label={t('auth.fullName')} htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={200} />
      </Field>
      <Field label={t('auth.phone')} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="[0-9+\- ]{9,15}" />
      </Field>
      <Field label={t('auth.birthDate')} htmlFor="birthDate">
        <Input id="birthDate" name="birthDate" type="date" max={today} min="1900-01-01" required />
      </Field>
      <Field label={t('auth.email')} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label={t('auth.password')} hint={t('auth.passwordHint')} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-brand" />
        <span>{t('auth.consent')}</span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? t('common.loading') : t('auth.register')}</Button>
    </form>
  )
}
