'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { changePassword } from '@/actions/auth'
import { Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'

export function ChangePasswordForm() {
  const t = useTranslations()
  const [state, action, pending] = useActionState(changePassword, null)
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label={t('password.new')} hint={t('auth.passwordHint')} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Field label={t('password.confirm')} htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? t('common.loading') : t('password.save')}</Button>
    </form>
  )
}
