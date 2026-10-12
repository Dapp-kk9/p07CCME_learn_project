import { getTranslations } from 'next-intl/server'
import { LangSwitch } from '@/components/lang-switch'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-lg font-semibold text-brand-dark">{t('app.name')}</span>
        <LangSwitch />
      </div>
      <main className="flex-1">{children}</main>
      <p className="mt-8 text-center text-xs text-muted">{t('app.emergency')}</p>
    </div>
  )
}
