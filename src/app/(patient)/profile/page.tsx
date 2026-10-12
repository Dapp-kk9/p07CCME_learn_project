import { getTranslations } from 'next-intl/server'
import { Card, PageTitle } from '@/components/ui'
import { createClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/components/change-password-form'
import { ProfileForm } from './form'

export default async function ProfilePage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const { data } = await supabase.from('patients').select('full_name, phone, birth_date, hn').eq('user_id', auth.user?.id ?? '').maybeSingle()
  return (
    <>
      <PageTitle title={t('profile.title')} />
      <div className="space-y-5">
        <Card>
          <ProfileForm
            fullName={data?.full_name ?? ''}
            phone={data?.phone ?? ''}
            birthDate={data?.birth_date ?? ''}
            hn={data?.hn ?? null}
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">{t('password.title')}</h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  )
}
