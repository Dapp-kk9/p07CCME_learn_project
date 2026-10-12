import 'server-only'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getRef, pick } from '@/lib/ref'
import { formatTime, type Locale } from '@/lib/date'
import { bangkokMinutes, bangkokToday } from '@/lib/date'
import type { ApptRow } from '@/lib/types'
import type { TicketData } from '@/components/appointment-ticket'

const COLS = 'id, clinic_id, doctor_id, room_id, session_id, appointment_date, appointment_time, reason, status'

export async function loadMyAppointments(opts: { scope: 'upcoming' | 'all' }): Promise<TicketData[]> {
  const supabase = await createClient()
  const locale = (await getLocale()) as Locale
  const ref = await getRef()
  const today = bangkokToday()

  let q = supabase.from('appointments').select(COLS)
  if (opts.scope === 'upcoming') {
    q = q.in('status', ['booked', 'checked_in']).gte('appointment_date', today).order('appointment_date').order('appointment_time')
  } else {
    q = q.order('appointment_date', { ascending: false }).order('appointment_time', { ascending: false }).limit(200)
  }
  const { data } = await q
  const rows = (data ?? []) as ApptRow[]

  const nowMin = bangkokMinutes()
  const queue = await Promise.all(
    rows.map(async (r) => {
      const isActive = r.status === 'booked' || r.status === 'checked_in'
      const future = r.appointment_date > today || (r.appointment_date === today && toMin(r.appointment_time) + 15 > nowMin)
      if (!isActive || !future) return null
      const { data: q2 } = await supabase.rpc('get_queue_info', { p_appointment_id: r.id })
      const row = Array.isArray(q2) ? q2[0] : null
      return row ? (row.queue_ahead as number) : null
    }),
  )

  return rows.map((r, i) => {
    const doc = ref.doctorById.get(r.doctor_id)
    const clinic = ref.clinicById.get(r.clinic_id)
    const room = ref.roomById.get(r.room_id)
    const sess = ref.sessionById.get(r.session_id)
    return {
      id: r.id,
      date: r.appointment_date,
      time: formatTime(r.appointment_time),
      status: r.status,
      reason: r.reason,
      clinic: clinic ? pick(locale, clinic.name, clinic.name_en) : '-',
      doctor: doc ? pick(locale, doc.full_name, doc.full_name_en) : '-',
      room: room ? (locale === 'en' ? `Room ${room.room_no}` : `ห้อง ${room.room_no}`) : '-',
      session: sess ? pick(locale, sess.name, sess.name_en) : '',
      queueAhead: queue[i],
    }
  })
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
