'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { actionRole } from '@/lib/auth'
import { fail, ok, toErrorCode, type ActionResult } from '@/lib/errors'
import { emailSchema, nameSchema, passwordSchema, phoneSchema, uuidSchema } from '@/lib/validation'

const createSchema = z.object({
  kind: z.enum(['doctor', 'nurse']),
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  fullNameEn: z.string().trim().max(200).optional(),
  phone: phoneSchema.or(z.literal('')).optional(),
  clinicId: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive().optional(),
})

/** สร้างบัญชีแพทย์/เจ้าหน้าที่: ใช้ service_role หลังตรวจว่าผู้เรียกเป็น admin เท่านั้น */
export async function createStaffAccount(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  const parsed = createSchema.safeParse({
    kind: form.get('kind'),
    email: form.get('email'),
    password: form.get('password'),
    fullName: form.get('fullName'),
    fullNameEn: form.get('fullNameEn') || undefined,
    phone: form.get('phone') || undefined,
    clinicId: form.get('clinicId'),
    roomId: form.get('roomId') || undefined,
  })
  if (!parsed.success) return fail(parsed.error.issues.some((i) => i.path[0] === 'password') ? 'WEAK_PASSWORD' : 'VALIDATION')
  const d = parsed.data
  if (d.kind === 'doctor' && !d.roomId) return fail('VALIDATION')

  const admin = createAdminClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.fullName, phone: d.phone ?? '' },
  })
  if (error || !created.user) return fail(/registered|exists/i.test(error?.message ?? '') ? 'EMAIL_TAKEN' : 'UNKNOWN')
  const uid = created.user.id

  const rollback = async () => { await admin.auth.admin.deleteUser(uid) }

  const { error: e1 } = await admin.from('profiles').update({ role: d.kind, must_change_password: true }).eq('id', uid)
  if (e1) { await rollback(); return fail('UNKNOWN') }
  await admin.from('patients').delete().eq('user_id', uid)

  if (d.kind === 'doctor') {
    const { error: e2 } = await admin.from('doctors').insert({
      user_id: uid, clinic_id: d.clinicId, room_id: d.roomId, full_name: d.fullName, full_name_en: d.fullNameEn || null,
    })
    if (e2) { await rollback(); return fail(toErrorCode(e2.message)) }
  } else {
    const { error: e2 } = await admin.from('clinic_staff').insert({ user_id: uid, clinic_id: d.clinicId })
    if (e2) { await rollback(); return fail('UNKNOWN') }
  }
  revalidatePath('/admin/doctors')
  revalidatePath('/admin/staff')
  return ok()
}

/** รีเซ็ตรหัสผ่านบัญชีแพทย์/เจ้าหน้าที่ (ผู้ป่วยใช้ขั้นตอนขอ-อนุมัติ-รับ) */
export async function resetStaffPassword(userId: string, password: string): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  const parsed = z.object({ id: uuidSchema, pw: passwordSchema }).safeParse({ id: userId, pw: password })
  if (!parsed.success) return fail('WEAK_PASSWORD')
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', parsed.data.id).maybeSingle()
  if (!p || !['doctor', 'nurse'].includes(p.role)) return fail('NOT_FOUND')
  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.pw })
  if (error) return fail('WEAK_PASSWORD')
  await admin.from('profiles').update({ must_change_password: true }).eq('id', parsed.data.id)
  return ok()
}

export async function setDoctorActive(doctorId: string, active: boolean): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(doctorId).success) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.from('doctors').update({ is_active: active }).eq('id', doctorId)
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/admin/doctors')
  return ok()
}

export async function setDoctorRoom(doctorId: string, roomId: number): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(doctorId).success || !Number.isInteger(roomId)) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.from('doctors').update({ room_id: roomId }).eq('id', doctorId)
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/admin/doctors')
  return ok()
}

export async function setSchedule(doctorId: string, weekday: number, sessionId: number, on: boolean): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(doctorId).success || weekday < 1 || weekday > 7) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = on
    ? await supabase.from('doctor_schedules').insert({ doctor_id: doctorId, weekday, session_id: sessionId })
    : await supabase.from('doctor_schedules').delete().eq('doctor_id', doctorId).eq('weekday', weekday).eq('session_id', sessionId)
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/admin/doctors')
  return ok()
}

export async function setStaffClinic(userId: string, clinicId: number, on: boolean): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(userId).success || !Number.isInteger(clinicId)) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = on
    ? await supabase.from('clinic_staff').insert({ user_id: userId, clinic_id: clinicId })
    : await supabase.from('clinic_staff').delete().eq('user_id', userId).eq('clinic_id', clinicId)
  if (error) return fail('UNKNOWN')
  revalidatePath('/admin/staff')
  return ok()
}

export async function saveSettings(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const g = await actionRole('admin')
  if ('error' in g) return g.error
  const parsed = z
    .object({
      slot_minutes: z.coerce.number().int().min(5).max(120),
      max_active_appointments: z.coerce.number().int().min(1).max(20),
      cancel_min_hours: z.coerce.number().int().min(0).max(72),
      booking_days_ahead: z.coerce.number().int().min(1).max(365),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) return fail('VALIDATION')
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings').update(parsed.data).eq('id', true)
  if (error) return fail('UNKNOWN')
  revalidatePath('/', 'layout')
  return ok()
}
