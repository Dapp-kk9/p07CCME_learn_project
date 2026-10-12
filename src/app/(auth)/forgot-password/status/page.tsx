import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getResetStatus } from '@/actions/reset'
import { Alert, Card } from '@/components/ui'
import { ClaimBox } from './claim'

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const t = await getTranslations()
  const s = await getResetStatus()

  if (!s) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t('forgot.statusTitle')}</h1>
        <Alert tone="amber">{t('forgot.noRequest')}</Alert>
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">{t('forgot.newRequest')}</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t('forgot.statusTitle')}</h1>
      <Card className="space-y-1 text-center">
        <p className="text-sm text-muted">{t('forgot.requestCode')}</p>
        <p className="text-4xl font-semibold tracking-[0.3em] tabular-nums">{s.code}</p>
      </Card>

      {s.status === 'pending' && (
        <>
          <Alert tone="amber">{t('forgot.pending')}</Alert>
          <p className="text-sm text-muted">{t('forgot.pendingHelp')}</p>
        </>
      )}
      {s.status === 'approved' && <ClaimBox />}
      {s.status === 'rejected' && <Alert>{t('forgot.rejected')}</Alert>}
      {s.status === 'expired' && <Alert tone="amber">{t('forgot.expired')}</Alert>}
      {s.status === 'claimed' && <Alert tone="ok">{t('forgot.claimed')}</Alert>}

      <div className="flex justify-between text-sm">
        <Link href="/login" className="text-brand hover:underline">{t('forgot.backToLogin')}</Link>
        {(s.status === 'rejected' || s.status === 'expired') && (
          <Link href="/forgot-password" className="text-brand hover:underline">{t('forgot.newRequest')}</Link>
        )}
      </div>
    </div>
  )
}
