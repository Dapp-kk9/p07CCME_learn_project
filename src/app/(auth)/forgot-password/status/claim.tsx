'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { claimReset } from '@/actions/reset'
import { Alert, Button } from '@/components/ui'
import type { ErrorCode } from '@/lib/errors'

export function ClaimBox() {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  if (password) {
    return (
      <div className="space-y-3">
        <Alert tone="ok">{t('forgot.claimedNow')}</Alert>
        <div className="rounded-lg border-2 border-brand bg-card p-4 text-center">
          <p className="text-sm text-muted">{t('forgot.tempPassword')}</p>
          <p className="mt-1 select-all break-all text-3xl font-semibold tracking-wider">{password}</p>
        </div>
        <Alert tone="amber">{t('forgot.showOnce')}</Alert>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <Alert tone="ok">{t('forgot.approved')}</Alert>
      {error && <Alert>{t(`errors.${error}`)}</Alert>}
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await claimReset()
            if (r.ok && r.data) setPassword(r.data.password)
            else if (!r.ok) setError(r.error)
          })
        }
      >
        {pending ? t('common.loading') : t('forgot.claim')}
      </Button>
    </div>
  )
}
