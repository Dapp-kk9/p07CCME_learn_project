import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fail, type ActionResult } from '@/lib/errors'

export type Role = 'patient' | 'doctor' | 'nurse' | 'admin'
export type Me = { id: string; email: string; role: Role; fullName: string; phone: string | null }

export const HOME: Record<Role, string> = { patient: '/', doctor: '/doctor', nurse: '/staff', admin: '/admin' }

export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: p } = await supabase.from('profiles').select('role, full_name, phone').eq('id', data.user.id).maybeSingle()
  if (!p) return null
  return { id: data.user.id, email: data.user.email ?? '', role: p.role as Role, fullName: p.full_name, phone: p.phone }
})

/** ใช้ใน layout/page (Server Component): ไม่ตรงบทบาท -> redirect */
export async function requireRole(...roles: Role[]): Promise<Me> {
  const me = await getMe()
  if (!me) redirect('/login')
  if (!roles.includes(me.role)) redirect(HOME[me.role])
  return me
}

/** ใช้ใน Server Action: คืน error แทน redirect */
export async function actionRole(...roles: Role[]): Promise<{ me: Me } | { error: ActionResult }> {
  const me = await getMe()
  if (!me) return { error: fail('NOT_AUTHENTICATED') }
  if (!roles.includes(me.role)) return { error: fail('FORBIDDEN') }
  return { me }
}
