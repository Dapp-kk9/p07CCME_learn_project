import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Clinic, DoctorRef, Room, Session, Settings } from '@/lib/types'
import type { Locale } from '@/lib/date'

export const getRef = cache(async () => {
  const supabase = await createClient()
  const [c, s, r, d, st] = await Promise.all([
    supabase.from('clinics').select('id, name, name_en').order('id'),
    supabase.from('sessions').select('id, name, name_en, start_time, end_time').order('start_time'),
    supabase.from('exam_rooms').select('id, clinic_id, room_no'),
    supabase.from('doctors').select('id, full_name, full_name_en, clinic_id, room_id'),
    supabase.from('app_settings').select('slot_minutes, max_active_appointments, cancel_min_hours, booking_days_ahead').maybeSingle(),
  ])
  const clinics = (c.data ?? []) as Clinic[]
  const sessions = (s.data ?? []) as Session[]
  const rooms = (r.data ?? []) as Room[]
  const doctors = (d.data ?? []) as DoctorRef[]
  const settings: Settings = (st.data as Settings | null) ?? { slot_minutes: 15, max_active_appointments: 3, cancel_min_hours: 2, booking_days_ahead: 30 }
  return {
    clinics, sessions, rooms, doctors, settings,
    clinicById: new Map(clinics.map((x) => [x.id, x])),
    sessionById: new Map(sessions.map((x) => [x.id, x])),
    roomById: new Map(rooms.map((x) => [x.id, x])),
    doctorById: new Map(doctors.map((x) => [x.id, x])),
  }
})

export const pick = (locale: Locale, th: string | null | undefined, en: string | null | undefined) =>
  (locale === 'en' ? en || th : th) ?? ''
