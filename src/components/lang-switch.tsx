'use client'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import clsx from 'clsx'
import { setLocale } from '@/actions/locale'

export function LangSwitch() {
  const locale = useLocale()
  const [pending, start] = useTransition()
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line text-sm" role="group" aria-label="Language">
      {(['th', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          onClick={() => start(() => setLocale(l))}
          className={clsx('min-h-9 px-3 font-medium', locale === l ? 'bg-brand text-white' : 'bg-card text-muted hover:bg-brand-soft')}
        >
          {l === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  )
}
