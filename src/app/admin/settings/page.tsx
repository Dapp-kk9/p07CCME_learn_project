import { getTranslations } from 'next-intl/server'
import { Card, PageTitle } from '@/components/ui'
import { getRef } from '@/lib/ref'
import { SettingsForm } from './form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const t = await getTranslations()
  const { settings } = await getRef()
  return (
    <>
      <PageTitle title={t('admin.settingsTitle')} />
      <Card><SettingsForm s={settings} /></Card>
    </>
  )
}
