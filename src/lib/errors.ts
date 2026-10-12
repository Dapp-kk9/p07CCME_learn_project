// รหัสข้อผิดพลาดจาก RPC/ฐานข้อมูล -> รหัสที่ frontend แปลเป็นข้อความ (messages/*.json -> errors.*)
export const KNOWN_ERRORS = [
  'NOT_AUTHENTICATED', 'FORBIDDEN', 'INVALID_INPUT', 'NOT_FOUND', 'DOCTOR_NOT_FOUND', 'DOCTOR_UNAVAILABLE',
  'SLOT_TAKEN', 'LIMIT_REACHED', 'TOO_LATE', 'TOO_FAR', 'TOO_LATE_TO_CANCEL', 'PATIENT_TIME_CONFLICT',
  'REASON_REQUIRED', 'REASON_TOO_LONG', 'NOT_A_PATIENT', 'MUST_CHANGE_PASSWORD', 'INVALID_TRANSITION',
  'NOT_ON_DUTY', 'NOT_APPOINTMENT_DAY', 'TOO_EARLY_FOR_NO_SHOW', 'USE_CANCEL_APPOINTMENT', 'HN_EMPTY', 'HN_TAKEN',
  'REQUEST_NOT_PENDING', 'NOT_APPROVED', 'RATE_LIMITED', 'ROOM_CONFLICT', 'TIME_NOT_ON_SLOT', 'TIME_OUT_OF_SESSION',
  'INVALID_CREDENTIALS', 'NO_MATCHING_ACCOUNT', 'NOT_PATIENT_ACCOUNT', 'WEAK_PASSWORD', 'EMAIL_TAKEN', 'VALIDATION', 'NO_PROFILE', 'UNKNOWN',
] as const

export type ErrorCode = (typeof KNOWN_ERRORS)[number]

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: ErrorCode }

const BY_LENGTH = [...KNOWN_ERRORS].sort((a, b) => b.length - a.length)

export function toErrorCode(message: string | undefined | null): ErrorCode {
  if (!message) return 'UNKNOWN'
  // ยาวสุดก่อน กันจับผิด เช่น TOO_LATE ใน TOO_LATE_TO_CANCEL
  const hit = BY_LENGTH.find((c) => message.includes(c))
  if (hit) return hit
  if (message.includes('uq_doctor_slot') || message.includes('uq_room_slot')) return 'SLOT_TAKEN'
  if (message.includes('uq_patient_slot')) return 'PATIENT_TIME_CONFLICT'
  return 'UNKNOWN'
}

export const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error })
export const ok = <T = undefined>(data?: T): { ok: true; data?: T } => ({ ok: true, data })
