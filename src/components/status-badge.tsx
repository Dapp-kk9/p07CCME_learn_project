import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import type { ApptStatus } from '@/lib/types'

const TONE = { booked: 'brand', checked_in: 'amber', completed: 'ok', cancelled: 'neutral', no_show: 'danger' } as const

export function StatusBadge({ status }: { status: ApptStatus }) {
  const t = useTranslations()
  return <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
}
