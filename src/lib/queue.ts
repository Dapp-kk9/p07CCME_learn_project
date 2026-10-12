import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { isValidDate, bangkokToday } from '@/lib/date'
import type { ApptStatus } from '@/lib/types'

export type QueueRow = {
  appointment_id: string
  doctor_id: string
  clinic_id: number
  room_id: number
  room_no: number
  session_id: number
  appointment_time: string
  patient_id: string
  patient_name: string
  hn: string | null
  reason: string
  status: ApptStatus
}

export function resolveDate(raw: string | undefined) {
  const today = bangkokToday()
  return { today, date: raw && isValidDate(raw) ? raw : today }
}

export async function loadQueue(date: string, filter: { doctorId?: string; clinicIds?: number[] }): Promise<QueueRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('v_doctor_queue')
    .select('appointment_id, doctor_id, clinic_id, room_id, room_no, session_id, appointment_time, patient_id, patient_name, hn, reason, status')
    .eq('appointment_date', date)
    .order('appointment_time')
  if (filter.doctorId) q = q.eq('doctor_id', filter.doctorId)
  if (filter.clinicIds) q = q.in('clinic_id', filter.clinicIds)
  const { data } = await q
  return (data ?? []) as QueueRow[]
}

export type RangeRow = QueueRow & { appointment_date: string }

export async function loadQueueRange(from: string, to: string, doctorId: string): Promise<RangeRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_doctor_queue')
    .select('appointment_id, appointment_date, doctor_id, clinic_id, room_id, room_no, session_id, appointment_time, patient_id, patient_name, hn, reason, status')
    .eq('doctor_id', doctorId)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .order('appointment_date')
    .order('appointment_time')
    .limit(2000)
  return (data ?? []) as RangeRow[]
}
