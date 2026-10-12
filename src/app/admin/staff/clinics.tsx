'use client'
import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import clsx from 'clsx'
import { setStaffClinic } from '@/actions/admin'
import type { Clinic } from '@/lib/types'

export function StaffClinics({ userId, clinics, selected }: { userId: string; clinics: Clinic[]; selected: number[] }) {
  const t = useTranslations()
  const locale = useLocale()
  const [on, setOn] = useState(new Set(selected))
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted">{t('admin.assignedClinics')}</p>
      <div className="flex flex-wrap gap-2">
        {clinics.map((c) => {
          const checked = on.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={checked}
              disabled={pending}
              onClick={() => start(async () => {
                const r = await setStaffClinic(userId, c.id, !checked)
                if (r.ok) { const n = new Set(on); checked ? n.delete(c.id) : n.add(c.id); setOn(n); setErr(null) }
                else setErr(t(`errors.${r.error}`))
              })}
              className={clsx('min-h-9 rounded-full border px-3 text-sm', checked ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:bg-brand-soft/60')}
            >
              {locale === 'en' ? c.name_en : c.name}
            </button>
          )
        })}
      </div>
      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
    </div>
  )
}
