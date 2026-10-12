import { getTranslations } from 'next-intl/server'
import { Empty, PageTitle } from '@/components/ui'
import { ResetRequests, type ResetRow } from '@/components/reset-requests'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ResetsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data } = await supabase.rpc('list_reset_requests')
  const rows = (data ?? []) as ResetRow[]
  return (
    <>
      <PageTitle title={t('resets.title')} sub={t('resets.sub')} />
      {rows.length === 0 ? <Empty title={t('resets.empty')} /> : <ResetRequests rows={rows} />}
    </>
  )
}
