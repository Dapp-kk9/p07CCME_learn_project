'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { login } from '@/actions/auth'
import { Button, Field, Input } from '@/components/ui'
import { FormError } from '@/components/form-error'

export function LoginForm() {
  const t = useTranslations()
  const [state, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label={t('auth.email')} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label={t('auth.password')} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? t('common.loading') : t('auth.login')}</Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/register" className="text-brand underline-offset-2 hover:underline">{t('auth.toRegister')}</Link>
        <Link href="/forgot-password" className="text-brand underline-offset-2 hover:underline">{t('auth.forgot')}</Link>
      </div>
    </form>
  )
}
