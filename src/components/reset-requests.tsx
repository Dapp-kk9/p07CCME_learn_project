'use client'
import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { decideReset } from '@/actions/queue'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { formatTimestamp, type Locale } from '@/lib/date'

export type ResetRow = {
  id: string
  status: 'pending' | 'approved'
  request_code: string
  email_entered: string
  phone_entered: string | null
  matched: boolean
  account_full_name: string | null
  account_phone: string | null
  created_at: string
  expires_at: string
}

export function ResetRequests({ rows }: { rows: ResetRow[] }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const act = (id: string, d: 'approve' | 'reject') =>
    start(async () => {
      const r = await decideReset(id, d)
      setErr(r.ok ? null : t(`errors.${r.error}`))
    })

  return (
    <div className="space-y-3">
      <Alert tone="brand">{t('resets.howTo')}</Alert>
      {err && <Alert>{err}</Alert>}
      {rows.map((r) => (
        <Card key={r.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xl font-semibold tracking-[0.25em] tabular-nums">{r.request_code}</p>
            <div className="flex gap-2">
              <Badge tone={r.status === 'pending' ? 'amber' : 'ok'}>{t(`resets.${r.status}`)}</Badge>
              <Badge tone={r.matched ? 'brand' : 'danger'}>{r.matched ? t('resets.matched') : t('resets.notMatched')}</Badge>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            <dt className="text-muted">{t('resets.emailEntered')}</dt><dd className="break-all">{r.email_entered}</dd>
            <dt className="text-muted">{t('resets.phoneEntered')}</dt><dd>{r.phone_entered ?? '-'}</dd>
            {r.matched && (
              <>
                <dt className="text-muted">{t('resets.accountName')}</dt><dd>{r.account_full_name}</dd>
                <dt className="text-muted">{t('resets.accountPhone')}</dt><dd>{r.account_phone ?? '-'}</dd>
              </>
            )}
            <dt className="text-muted">{t('resets.requestedAt')}</dt><dd>{formatTimestamp(r.created_at, locale)}</dd>
            {r.status === 'approved' && (<><dt className="text-muted">{t('resets.claimBefore')}</dt><dd>{formatTimestamp(r.expires_at, locale)}</dd></>)}
          </dl>
          {r.status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending || !r.matched} onClick={() => act(r.id, 'approve')}>{t('resets.approve')}</Button>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => act(r.id, 'reject')}>{t('resets.reject')}</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
