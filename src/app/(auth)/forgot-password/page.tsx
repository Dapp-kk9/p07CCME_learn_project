import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ForgotForm } from './form'

export default async function ForgotPage() {
  const t = await getTranslations()
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('forgot.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('forgot.sub')}</p>
      </div>
      <ForgotForm />
      <div className="flex justify-between text-sm">
        <Link href="/login" className="text-brand hover:underline">{t('forgot.backToLogin')}</Link>
        <Link href="/forgot-password/status" className="text-brand hover:underline">{t('forgot.checkStatus')}</Link>
      </div>
    </div>
  )
}
