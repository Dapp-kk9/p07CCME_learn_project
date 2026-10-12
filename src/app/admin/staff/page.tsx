import { getLocale, getTranslations } from 'next-intl/server'
import { Card, Empty, PageTitle } from '@/components/ui'
import { ResetPasswordBox } from '@/components/reset-password-box'
import { createClient } from '@/lib/supabase/server'
import { getRef } from '@/lib/ref'
import { getEmailMap } from '@/lib/admin-users'
import { CreateStaffForm } from '../create-form'
import { StaffClinics } from './clinics'

export const dynamic = 'force-dynamic'

export default async function AdminStaff() {
  const t = await getTranslations()
  const _locale = await getLocale()
  const supabase = await createClient()
  const ref = await getRef()
  const [{ data: nurses }, { data: links }, emails] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'nurse').order('full_name'),
    supabase.from('clinic_staff').select('user_id, clinic_id'),
    getEmailMap(),
  ])
  void _locale

  return (
    <>
      <PageTitle title={t('admin.staffTitle')} />
      <div className="mb-6"><CreateStaffForm kind="nurse" clinics={ref.clinics} rooms={[]} /></div>
      {(nurses ?? []).length === 0 ? <Empty title={t('admin.noStaff')} /> : (
        <div className="space-y-3">
          {(nurses ?? []).map((n) => (
            <Card key={n.id} className="space-y-3">
              <div>
                <p className="font-semibold">{n.full_name}</p>
                <p className="text-sm text-muted">{emails.get(n.id) ?? ''}{n.phone ? ` · ${n.phone}` : ''}</p>
              </div>
              <StaffClinics
                userId={n.id}
                clinics={ref.clinics}
                selected={(links ?? []).filter((l) => l.user_id === n.id).map((l) => l.clinic_id as number)}
              />
              <ResetPasswordBox userId={n.id} />
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
