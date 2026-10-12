import { getLocale, getTranslations } from 'next-intl/server'
import { Badge, Card, Empty, PageTitle } from '@/components/ui'
import { ResetPasswordBox } from '@/components/reset-password-box'
import { createClient } from '@/lib/supabase/server'
import { getRef, pick } from '@/lib/ref'
import { getEmailMap } from '@/lib/admin-users'
import type { Locale } from '@/lib/date'
import { CreateStaffForm } from '../create-form'
import { DoctorControls } from './controls'

export const dynamic = 'force-dynamic'

export default async function AdminDoctors() {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const supabase = await createClient()
  const ref = await getRef()
  const [{ data: docs }, { data: scheds }, emails] = await Promise.all([
    supabase.from('doctors').select('id, user_id, clinic_id, room_id, full_name, full_name_en, is_active').order('clinic_id').order('full_name'),
    supabase.from('doctor_schedules').select('doctor_id, weekday, session_id'),
    getEmailMap(),
  ])

  return (
    <>
      <PageTitle title={t('admin.doctorsTitle')} />
      <div className="mb-6">
        <CreateStaffForm kind="doctor" clinics={ref.clinics} rooms={ref.rooms} />
      </div>
      {(docs ?? []).length === 0 ? <Empty title={t('admin.noDoctors')} /> : (
        <div className="space-y-3">
          {(docs ?? []).map((d) => {
            const clinic = ref.clinicById.get(d.clinic_id)
            const room = ref.roomById.get(d.room_id)
            return (
              <Card key={d.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pick(locale, d.full_name, d.full_name_en)}</p>
                    <p className="text-sm text-muted">{clinic ? pick(locale, clinic.name, clinic.name_en) : ''} · {t('book.room', { no: room?.room_no ?? 0 })} · {emails.get(d.user_id) ?? ''}</p>
                  </div>
                  <Badge tone={d.is_active ? 'ok' : 'neutral'}>{d.is_active ? t('admin.active') : t('admin.inactive')}</Badge>
                </div>
                <DoctorControls
                  doctorId={d.id}
                  userId={d.user_id}
                  isActive={d.is_active}
                  roomId={d.room_id}
                  rooms={ref.rooms.filter((r) => r.clinic_id === d.clinic_id)}
                  sessions={ref.sessions}
                  schedule={(scheds ?? []).filter((s) => s.doctor_id === d.id).map((s) => `${s.weekday}-${s.session_id}`)}
                />
                <ResetPasswordBox userId={d.user_id} />
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
