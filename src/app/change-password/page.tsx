import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth'
import { LangSwitch } from '@/components/lang-switch'
import { ChangePasswordForm } from '@/components/change-password-form'

export default async function ChangePasswordPage() {
  await requireRole('patient', 'doctor', 'nurse', 'admin')
  const t = await getTranslations()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-lg font-semibold text-brand-dark">{t('app.name')}</span>
        <LangSwitch />
      </div>
      <h1 className="text-2xl font-semibold">{t('password.title')}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{t('password.forcedSub')}</p>
      <ChangePasswordForm />
    </div>
  )
}
