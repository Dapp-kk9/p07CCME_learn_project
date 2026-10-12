import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { RegisterForm } from './form'

export default async function RegisterPage() {
  const t = await getTranslations()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('auth.registerTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.registerSub')}</p>
      </div>
      <RegisterForm />
      <p className="text-sm">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="text-brand underline-offset-2 hover:underline">{t('auth.login')}</Link>
      </p>
    </div>
  )
}
