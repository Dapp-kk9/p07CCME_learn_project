export type ApptStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'

export type Clinic = { id: number; name: string; name_en: string }
export type Session = { id: number; name: string; name_en: string; start_time: string; end_time: string }
export type Room = { id: number; clinic_id: number; room_no: number }
export type DoctorRef = { id: string; full_name: string; full_name_en: string | null; clinic_id: number; room_id: number }
export type Settings = { slot_minutes: number; max_active_appointments: number; cancel_min_hours: number; booking_days_ahead: number }

export type DoctorListItem = {
  doctor_id: string
  clinic_id: number
  room_id: number
  room_no: number
  full_name: string
  full_name_en: string | null
  schedules: { weekday: number; session_id: number }[]
}

export type ApptRow = {
  id: string
  clinic_id: number
  doctor_id: string
  room_id: number
  session_id: number
  appointment_date: string
  appointment_time: string
  reason: string
  status: ApptStatus
}

export type SlotRow = { slot_time: string; session_id: number; is_taken: boolean; is_bookable: boolean; queue_ahead: number }
