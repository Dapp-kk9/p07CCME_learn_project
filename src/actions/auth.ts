'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMe } from '@/lib/auth'
import { fail, ok, type ActionResult } from '@/lib/errors'
import { birthDateSchema, emailSchema, nameSchema, passwordSchema, phoneSchema } from '@/lib/validation'

export async function login(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).safeParse({
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!parsed.success) return fail('INVALID_CREDENTIALS')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return fail('INVALID_CREDENTIALS')
  redirect('/')
}

export async function register(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      fullName: nameSchema,
      phone: phoneSchema,
      birthDate: birthDateSchema,
      email: emailSchema,
      password: passwordSchema,
      consent: z.literal('on'),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return fail(parsed.error.issues.some((i) => i.path[0] === 'password') ? 'WEAK_PASSWORD' : 'VALIDATION')
  }
  const d = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: { data: { full_name: d.fullName, phone: d.phone, birth_date: d.birthDate } },
  })
  if (error) {
    if (/registered|exists/i.test(error.message)) return fail('EMAIL_TAKEN')
    if (/password/i.test(error.message)) return fail('WEAK_PASSWORD')
    if (/rate/i.test(error.message)) return fail('RATE_LIMITED')
    return fail('UNKNOWN')
  }
  // ถ้าโปรเจกต์ยังเปิด "Confirm email" จะไม่มีเซสชัน
  if (!data.session) return fail('UNKNOWN')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/** เปลี่ยนรหัสผ่าน: ใช้ทั้งหน้าบังคับเปลี่ยนและหน้าโปรไฟล์ */
export async function changePassword(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getMe()
  if (!me) return fail('NOT_AUTHENTICATED')
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm)
    .safeParse({ password: form.get('password'), confirm: form.get('confirm') })
  if (!parsed.success) return fail('WEAK_PASSWORD')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return fail('WEAK_PASSWORD')

  // ผู้ใช้แก้ must_change_password เองไม่ได้ (ไม่มี column grant) จึงเคลียร์ด้วย service_role หลังเปลี่ยนรหัสสำเร็จเท่านั้น
  const admin = createAdminClient()
  const { error: e2 } = await admin.from('profiles').update({ must_change_password: false }).eq('id', me.id)
  if (e2) return fail('UNKNOWN')
  redirect('/')
}

export async function updateProfile(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getMe()
  if (!me || me.role !== 'patient') return fail('FORBIDDEN')
  const parsed = z
    .object({ fullName: nameSchema, phone: phoneSchema, birthDate: birthDateSchema.or(z.literal('')) })
    .safeParse({ fullName: form.get('fullName'), phone: form.get('phone'), birthDate: form.get('birthDate') ?? '' })
  if (!parsed.success) return fail('VALIDATION')
  const supabase = await createClient()
  const { error } = await supabase
    .from('patients')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone, birth_date: parsed.data.birthDate || null })
    .eq('user_id', me.id)
  if (error) return fail('UNKNOWN')
  return ok()
}
