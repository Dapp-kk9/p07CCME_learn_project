'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { requestReset } from '@/actions/reset'
import { Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'

export function ForgotForm() {
  const t = useTranslations()
  const [state, action, pending] = useActionState(requestReset, null)
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label={t('auth.email')} htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label={t('forgot.phoneLabel')} hint={t('forgot.phoneHint')} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" required pattern="[0-9+\- ]{9,15}" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? t('common.loading') : t('forgot.submit')}</Button>
    </form>
  )
}
