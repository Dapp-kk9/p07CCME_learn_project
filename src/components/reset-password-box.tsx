'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { resetStaffPassword } from '@/actions/admin'
import { Alert, Button, Input } from '@/components/ui'

export function ResetPasswordBox({ userId }: { userId: string }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t('admin.resetPassword')}</Button>
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('admin.newPassword')} className="min-h-9 w-56 text-sm" minLength={8} maxLength={72} autoComplete="off" />
        <Button size="sm" disabled={pending || pw.length < 8} onClick={() => start(async () => {
          const r = await resetStaffPassword(userId, pw)
          setMsg(r.ok ? { ok: true, text: t('admin.resetDone') } : { ok: false, text: t(`errors.${r.error}`) })
          if (r.ok) setPw('')
        })}>{t('common.save')}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setMsg(null) }}>{t('common.back')}</Button>
      </div>
      {msg && <Alert tone={msg.ok ? 'ok' : 'danger'}>{msg.text}</Alert>}
      <p className="text-xs text-muted">{t('admin.resetHint')}</p>
    </div>
  )
}
