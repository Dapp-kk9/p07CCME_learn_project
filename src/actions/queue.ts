'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { actionRole } from '@/lib/auth'
import { fail, ok, toErrorCode, type ActionResult } from '@/lib/errors'
import { uuidSchema } from '@/lib/validation'

const refresh = () => {
  revalidatePath('/doctor')
  revalidatePath('/staff')
  revalidatePath('/admin/appointments')
}

export async function setStatus(id: string, status: 'checked_in' | 'completed' | 'no_show'): Promise<ActionResult> {
  const g = await actionRole('doctor', 'nurse', 'admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(id).success || !['checked_in', 'completed', 'no_show'].includes(status)) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_appointment_status', { p_appointment_id: id, p_new_status: status })
  if (error) return fail(toErrorCode(error.message))
  refresh()
  return ok()
}

export async function cancelByStaff(id: string, reason: string): Promise<ActionResult> {
  const g = await actionRole('nurse', 'admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(id).success) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: id, p_reason: reason.trim().slice(0, 200) || 'เจ้าหน้าที่ยกเลิก' })
  if (error) return fail(toErrorCode(error.message))
  refresh()
  return ok()
}

export async function saveHn(patientId: string, hn: string): Promise<ActionResult> {
  const g = await actionRole('nurse', 'admin')
  if ('error' in g) return g.error
  const parsed = z.object({ id: uuidSchema, hn: z.string().trim().min(1).max(30) }).safeParse({ id: patientId, hn })
  if (!parsed.success) return fail('HN_EMPTY')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_patient_hn', { p_patient_id: parsed.data.id, p_hn: parsed.data.hn })
  if (error) return fail(toErrorCode(error.message))
  refresh()
  return ok()
}

export async function decideReset(id: string, decision: 'approve' | 'reject'): Promise<ActionResult> {
  const g = await actionRole('nurse', 'admin')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(id).success) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.rpc(decision === 'approve' ? 'approve_reset_request' : 'reject_reset_request', { p_id: id })
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/staff/resets')
  revalidatePath('/staff')
  revalidatePath('/admin')
  return ok()
}
