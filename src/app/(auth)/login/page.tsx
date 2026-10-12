import { LoginForm } from './form'
import { getTranslations } from 'next-intl/server'
import { Alert } from '@/components/ui'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations()
  const { error } = await searchParams
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('auth.loginTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.loginSub')}</p>
      </div>
      {error === 'NO_PROFILE' && <Alert>{t('errors.NO_PROFILE')}</Alert>}
      <LoginForm />
    </div>
  )
}
