'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { actionRole } from '@/lib/auth'
import { fail, ok, toErrorCode, type ActionResult } from '@/lib/errors'
import { isoDateSchema, uuidSchema } from '@/lib/validation'
import type { SlotRow } from '@/lib/types'

export async function getSlots(doctorId: string, date: string): Promise<ActionResult<SlotRow[]>> {
  const g = await actionRole('patient')
  if ('error' in g) return g.error
  const parsed = z.object({ doctorId: uuidSchema, date: isoDateSchema }).safeParse({ doctorId, date })
  if (!parsed.success) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_available_slots', { p_doctor_id: doctorId, p_date: date })
  if (error) return fail(toErrorCode(error.message))
  return ok((data ?? []) as SlotRow[])
}

export async function bookAppointment(input: {
  doctorId: string
  date: string
  time: string
  reason: string
}): Promise<ActionResult<string>> {
  const g = await actionRole('patient')
  if ('error' in g) return g.error
  const parsed = z
    .object({
      doctorId: uuidSchema,
      date: isoDateSchema,
      time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      reason: z.string().trim().min(1).max(500),
    })
    .safeParse(input)
  if (!parsed.success) return fail(input.reason?.trim() ? 'INVALID_INPUT' : 'REASON_REQUIRED')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('book_appointment', {
    p_doctor_id: parsed.data.doctorId,
    p_date: parsed.data.date,
    p_time: parsed.data.time,
    p_reason: parsed.data.reason,
  })
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/')
  revalidatePath('/appointments')
  return ok(data as string)
}

export async function cancelMyAppointment(id: string): Promise<ActionResult> {
  const g = await actionRole('patient')
  if ('error' in g) return g.error
  if (!uuidSchema.safeParse(id).success) return fail('INVALID_INPUT')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: id, p_reason: 'ผู้ป่วยยกเลิกเอง' })
  if (error) return fail(toErrorCode(error.message))
  revalidatePath('/')
  revalidatePath('/appointments')
  return ok()
}
