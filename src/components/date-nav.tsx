'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { addDays, formatDate, type Locale } from '@/lib/date'

export function DateNav({ date, today }: { date: string; today: string }) {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const go = (d: string) => {
    const p = new URLSearchParams(sp.toString())
    p.set('date', d)
    router.push(`${path}?${p.toString()}`)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" aria-label={t('common.prevDay')} onClick={() => go(addDays(date, -1))}><ChevronLeft size={16} /></Button>
      <div className="min-w-44 text-center text-sm font-medium">{formatDate(date, locale, 'long')}</div>
      <Button variant="secondary" size="sm" aria-label={t('common.nextDay')} onClick={() => go(addDays(date, 1))}><ChevronRight size={16} /></Button>
      {date !== today && <Button variant="ghost" size="sm" onClick={() => go(today)}>{t('common.today')}</Button>}
    </div>
  )
}
