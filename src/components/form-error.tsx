'use client'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui'
import type { ActionResult } from '@/lib/errors'

export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  const t = useTranslations()
  if (!state || state.ok) return null
  return <Alert>{t(`errors.${state.error}`)}</Alert>
}
