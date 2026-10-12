'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { setStatus } from '@/actions/queue'
import { Button } from '@/components/ui'

export function CompleteButton({ id }: { id: string }) {
  const t = useTranslations()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <div>
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const r = await setStatus(id, 'completed')
        setErr(r.ok ? null : t(`errors.${r.error}`))
      })}>
        {t('doctor.complete')}
      </Button>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  )
}
