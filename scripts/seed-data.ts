// =====================================================
// scripts/seed-data.ts
// ข้อมูลจำลองสำหรับทดสอบระบบนัดหมายแพทย์ (ไม่มี I/O ใด ๆ)
// ชื่อ เบอร์โทร และอาการทั้งหมดเป็นข้อมูลสมมติ
// ผลลัพธ์คงที่ (deterministic) รันซ้ำได้ผลเหมือนเดิมในวันเดียวกัน
// =====================================================

export type ClinicName = 'Surgery' | 'Internal Medicine' | 'Ophthalmology' | 'ENT' | 'Dermatology'
export type SessionName = 'Morning' | 'Afternoon'
export type ApptStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'

export const CLINIC_ROOMS: Record<ClinicName, number> = {
  Surgery: 5,
  'Internal Medicine': 5,
  Ophthalmology: 3,
  ENT: 3,
  Dermatology: 2,
}

export const SESSION_TIMES: Record<SessionName, { start: string; end: string }> = {
  Morning: { start: '08:30', end: '12:00' },
  Afternoon: { start: '13:00', end: '16:30' },
}

export const SLOT_MINUTES = 15
export const MAX_ACTIVE_PER_PATIENT = 3

// ---------- เวลา/วันที่ (เขตเวลา Asia/Bangkok) ----------

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function slotsOf(session: SessionName): string[] {
  const { start, end } = SESSION_TIMES[session]
  const out: string[] = []
  for (let t = toMin(start); t + SLOT_MINUTES <= toMin(end); t += SLOT_MINUTES) out.push(fromMin(t))
  return out
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 1 = จันทร์ ... 7 = อาทิตย์ (ISO) */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function bangkokNow(now: Date = new Date()): { date: string; minutes: number } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const p: Record<string, string> = {}
  for (const part of f.formatToParts(now)) p[part.type] = part.value
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}

// ---------- แพทย์ ----------

export interface ScheduleEntry {
  weekday: number
  session: SessionName
}

export interface DoctorDef {
  n: number
  email: string
  fullName: string
  fullNameEn: string
  clinic: ClinicName
  roomNo: number
  pattern: string
  schedule: ScheduleEntry[]
}

// [ชื่อไทย, ชื่ออังกฤษ, คลินิก, ห้อง] เรียงตามคลินิกและห้อง 1 คนต่อห้อง รวม 18 คน
const BASE_DOCTORS: Array<[string, string, ClinicName, number]> = [
  ['นพ.สมชาย ใจดี', 'Dr. Somchai Jaidee', 'Surgery', 1],
  ['นพ.วิชัย รักษา', 'Dr. Wichai Raksa', 'Surgery', 2],
  ['นพ.ประเสริฐ ศรีทอง', 'Dr. Prasert Srithong', 'Surgery', 3],
  ['นพ.อนุชา พงษ์ไพร', 'Dr. Anucha Phongphrai', 'Surgery', 4],
  ['พญ.กิตติยา มั่นคง', 'Dr. Kittiya Mankhong', 'Surgery', 5],
  ['พญ.สุดา วงศ์สวัสดิ์', 'Dr. Suda Wongsawat', 'Internal Medicine', 1],
  ['นพ.ธีรพงษ์ แก้วมณี', 'Dr. Theerapong Kaewmanee', 'Internal Medicine', 2],
  ['พญ.มาลี สุขสันต์', 'Dr. Malee Suksan', 'Internal Medicine', 3],
  ['นพ.ปกรณ์ เจริญผล', 'Dr. Pakorn Charoenphon', 'Internal Medicine', 4],
  ['พญ.นภา ทองดี', 'Dr. Napa Thongdee', 'Internal Medicine', 5],
  ['นพ.ชัยวัฒน์ แสงจันทร์', 'Dr. Chaiwat Saengchan', 'Ophthalmology', 1],
  ['พญ.รุ่งนภา ดวงดี', 'Dr. Rungnapa Duangdee', 'Ophthalmology', 2],
  ['นพ.ภานุ เลิศวิทย์', 'Dr. Phanu Lertwit', 'Ophthalmology', 3],
  ['นพ.อดิศร บุญมา', 'Dr. Adisorn Boonma', 'ENT', 1],
  ['พญ.ศิริพร จันทร์เพ็ญ', 'Dr. Siriporn Janpen', 'ENT', 2],
  ['นพ.วรวุฒิ สุขใจ', 'Dr. Worawut Sukjai', 'ENT', 3],
  ['พญ.กนกวรรณ พึ่งพา', 'Dr. Kanokwan Phuengpha', 'Dermatology', 1],
  ['นพ.ณัฐพล รุ่งเรือง', 'Dr. Nattapon Rungruang', 'Dermatology', 2],
]

// แพทย์เสริม 3 คน ใช้ห้องร่วมกับแพทย์หลักที่ออกตรวจ "เช้าอย่างเดียว" โดยออกตรวจ "บ่าย" แทน
// (ทดสอบกฎห้องเดียวกันห้ามออกตรวจชนกัน) [ชื่อไทย, ชื่ออังกฤษ, index ของแพทย์หลักที่ใช้ห้องร่วมกัน]
const EXTRA_DOCTORS: Array<[string, string, number]> = [
  ['พญ.ปิยะนุช สายสุวรรณ', 'Dr. Piyanuch Saisuwan', 1],
  ['นพ.เอกชัย บุญรอด', 'Dr. Ekkachai Boonrot', 7],
  ['พญ.จิราพร ใสสะอาด', 'Dr. Jiraporn Saisaard', 13],
]

const PATTERNS = ['both', 'morning', 'afternoon', 'both', 'mwf-morning', 'tth-both']

function scheduleOf(pattern: string): ScheduleEntry[] {
  const out: ScheduleEntry[] = []
  const add = (days: number[], sessions: SessionName[]) => {
    for (const weekday of days) for (const session of sessions) out.push({ weekday, session })
  }
  const weekdays = [1, 2, 3, 4, 5]
  switch (pattern) {
    case 'both':
      add(weekdays, ['Morning', 'Afternoon'])
      break
    case 'morning':
      add(weekdays, ['Morning'])
      break
    case 'afternoon':
      add(weekdays, ['Afternoon'])
      break
    case 'mwf-morning':
      add([1, 3, 5], ['Morning'])
      break
    case 'tth-both':
      add([2, 4], ['Morning', 'Afternoon'])
      break
    default:
      throw new Error(`unknown pattern ${pattern}`)
  }
  return out
}

export function buildDoctors(): DoctorDef[] {
  const doctors: DoctorDef[] = BASE_DOCTORS.map(([fullName, fullNameEn, clinic, roomNo], i) => {
    const pattern = PATTERNS[i % PATTERNS.length]
    return {
      n: i + 1,
      email: `doctor${String(i + 1).padStart(2, '0')}@test.local`,
      fullName,
      fullNameEn,
      clinic,
      roomNo,
      pattern,
      schedule: scheduleOf(pattern),
    }
  })
  EXTRA_DOCTORS.forEach(([fullName, fullNameEn, baseIdx], k) => {
    const base = doctors[baseIdx]
    if (base.pattern !== 'morning') throw new Error('extra doctor must share a room with a morning-only doctor')
    const n = BASE_DOCTORS.length + k + 1
    doctors.push({
      n,
      email: `doctor${String(n).padStart(2, '0')}@test.local`,
      fullName,
      fullNameEn,
      clinic: base.clinic,
      roomNo: base.roomNo,
      pattern: 'afternoon',
      schedule: scheduleOf('afternoon'),
    })
  })
  return doctors
}

// ---------- เจ้าหน้าที่หน้าห้องตรวจ (ผูกกับคลินิก) ----------

export interface StaffDef {
  n: number
  email: string
  fullName: string
  phone: string
  clinic: ClinicName
}

const NURSES: Array<[string, ClinicName]> = [
  ['พยาบาลสมหญิง ใจเย็น', 'Surgery'],
  ['พยาบาลวันดี มีสุข', 'Surgery'],
  ['พยาบาลรัตนา สงบสุข', 'Internal Medicine'],
  ['พยาบาลบุญเรือน ดีเลิศ', 'Internal Medicine'],
  ['พยาบาลพิมพ์ใจ รักงาน', 'Ophthalmology'],
  ['พยาบาลอรทัย สดใส', 'Ophthalmology'],
  ['พยาบาลสุภาพ อ่อนโยน', 'ENT'],
  ['พยาบาลจันทร์เพ็ญ ชื่นบาน', 'ENT'],
  ['พยาบาลปรีดา คล่องแคล่ว', 'Dermatology'],
  ['พยาบาลนิตยา เรียบร้อย', 'Dermatology'],
]

export function buildNurses(): StaffDef[] {
  return NURSES.map(([fullName, clinic], i) => ({
    n: i + 1,
    email: `nurse${String(i + 1).padStart(2, '0')}@test.local`,
    fullName,
    phone: `09${String(10000000 + i * 1111111).slice(0, 8)}`,
    clinic,
  }))
}

// ---------- ผู้ป่วย ----------

export interface PatientDef {
  n: number
  email: string
  fullName: string
  phone: string
  birthDate: string
  hn: string | null
}

const FIRST_NAMES = [
  'สมศรี', 'วิรัตน์', 'ปราณี', 'ชาติชาย', 'อรุณี', 'บุญมี', 'สุรชัย', 'จินตนา', 'ประยุทธ', 'ละออง',
  'เกศินี', 'ธนากร', 'พรทิพย์', 'สมบัติ', 'วันเพ็ญ', 'อภิชาติ', 'นงลักษณ์', 'ศักดิ์ชัย', 'กาญจนา', 'ไพโรจน์',
  'รัชนี', 'มานะ', 'สุมาลี', 'ธวัชชัย', 'พิมพา', 'ยุทธนา', 'ศรีสุดา', 'เฉลิมชัย', 'อัจฉรา', 'ชูศักดิ์',
]
const LAST_NAMES = [
  'ทองสุข', 'แสนดี', 'มีโชค', 'รุ่งโรจน์', 'เพชรรัตน์', 'บุญเลิศ', 'วัฒนากุล', 'สุขเกษม', 'ชัยมงคล', 'ศรีสว่าง',
  'พงษ์พานิช', 'อินทรโชติ', 'จันทร์หอม', 'ดวงแก้ว', 'เกียรติศักดิ์', 'นิลวงศ์', 'สมบูรณ์', 'พิทักษ์', 'ปัญญาดี', 'กล้าหาญ',
]

export function buildPatients(): PatientDef[] {
  const out: PatientDef[] = []
  for (let i = 0; i < 30; i++) {
    const n = i + 1
    const year = 1955 + ((n * 7) % 60)
    const month = 1 + ((n * 5) % 12)
    const day = 1 + ((n * 11) % 28)
    out.push({
      n,
      email: `patient${String(n).padStart(2, '0')}@test.local`,
      fullName: `${FIRST_NAMES[i]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`,
      phone: `08${String(10000000 + ((n * 7654321) % 89999999))}`,
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      // 20 คนแรกมี HN (เคยมาแจ้งที่โรงพยาบาลแล้ว) อีก 10 คนยังไม่มี
      hn: n <= 20 ? `HN${100000 + n * 37}` : null,
    })
  }
  return out
}

// ---------- นัดหมาย ----------

const REASONS: Record<ClinicName, string[]> = {
  Surgery: [
    'มีก้อนที่หน้าท้อง คลำได้ 2 สัปดาห์',
    'แผลผ่าตัดบวมแดง',
    'ปวดท้องน้อยด้านขวา',
    'ไส้เลื่อนที่ขาหนีบ',
    'บาดแผลที่มือ ต้องการตรวจซ้ำ',
    'ติดตามอาการหลังผ่าตัดถุงน้ำดี',
  ],
  'Internal Medicine': [
    'มีไข้และไอมา 3 วัน',
    'ตรวจติดตามเบาหวาน',
    'ความดันสูง ปวดศีรษะบ่อย',
    'เหนื่อยง่าย ใจสั่น',
    'ท้องเสียมา 2 วัน',
    'ปวดท้องหลังรับประทานอาหาร',
  ],
  Ophthalmology: [
    'ตามัวทั้งสองข้าง',
    'ตาแดง ระคายเคือง',
    'ปวดตาข้างซ้าย',
    'น้ำตาไหลตลอดเวลา',
    'ตรวจติดตามต้อกระจก',
    'เห็นภาพซ้อนเป็นบางครั้ง',
  ],
  ENT: [
    'เจ็บคอ กลืนลำบาก',
    'คัดจมูก น้ำมูกเขียว',
    'ปวดหูข้างขวา',
    'หูอื้อ เวียนศีรษะ',
    'เสียงแหบเรื้อรัง',
    'ไซนัสอักเสบกำเริบ',
  ],
  Dermatology: [
    'ผื่นคันตามแขนขา',
    'สิวอักเสบ',
    'ผิวแห้งลอกเป็นขุย',
    'ผมร่วงมากผิดปกติ',
    'ลมพิษขึ้นบ่อย',
    'ฝ้ากระ ต้องการปรึกษา',
  ],
}

export interface ApptDef {
  patientIdx: number
  doctorIdx: number
  date: string
  time: string
  session: SessionName
  reason: string
  status: ApptStatus
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface AppointmentPlan {
  appts: ApptDef[]
  notes: string[]
  scenarios: {
    busyMorning: { doctorIdx: number; date: string; count: number } | null
    busyAfternoon: { doctorIdx: number; date: string; count: number } | null
    twoFuturePatientIdx: number
    limitReachedPatientIdx: number
    soonPatientIdx: number | null
  }
}

export function buildAppointments(
  today: string,
  nowMinutes: number,
  doctors: DoctorDef[],
  patients: PatientDef[],
  targetTotal = 90,
): AppointmentPlan {
  const rng = mulberry32(20261012)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const appts: ApptDef[] = []
  const notes: string[] = []
  const usedDoctorSlot = new Set<string>()
  const usedPatientSlot = new Set<string>()
  const activeFuture: number[] = patients.map(() => 0)

  const isActive = (s: ApptStatus) => s === 'booked' || s === 'checked_in'
  const isUpcoming = (date: string, time: string) =>
    date > today || (date === today && toMin(time) >= nowMinutes)

  function sessionsOn(d: DoctorDef, date: string): SessionName[] {
    const wd = isoWeekday(date)
    return (['Morning', 'Afternoon'] as SessionName[]).filter((s) =>
      d.schedule.some((x) => x.weekday === wd && x.session === s),
    )
  }

  function tryAdd(a: ApptDef): boolean {
    const dk = `${a.doctorIdx}|${a.date}|${a.time}`
    const pk = `${a.patientIdx}|${a.date}|${a.time}`
    if (usedDoctorSlot.has(dk) || usedPatientSlot.has(pk)) return false
    const counts = isActive(a.status) && isUpcoming(a.date, a.time)
    if (counts && activeFuture[a.patientIdx] >= MAX_ACTIVE_PER_PATIENT) return false
    usedDoctorSlot.add(dk)
    usedPatientSlot.add(pk)
    if (counts) activeFuture[a.patientIdx]++
    appts.push(a)
    return true
  }

  const reasonFor = (d: DoctorDef) => pick(REASONS[d.clinic])

  function addRandomSlot(patientIdx: number, doctorIdx: number, date: string, session: SessionName, status: ApptStatus): boolean {
    const d = doctors[doctorIdx]
    for (let k = 0; k < 30; k++) {
      const time = pick(slotsOf(session))
      if (tryAdd({ patientIdx, doctorIdx, date, time, session, reason: reasonFor(d), status })) return true
    }
    return false
  }

  function firstDutyDate(doctorIdx: number, session: SessionName, fromOffset: number): string | null {
    for (let k = fromOffset; k < fromOffset + 14; k++) {
      const date = addDays(today, k)
      if (sessionsOn(doctors[doctorIdx], date).includes(session)) return date
    }
    return null
  }

  // --- สถานการณ์ A: วันที่มีคิวแน่น (10+ คิว) เพื่อทดสอบการนับคิวก่อนหน้า ---
  const busy = (doctorIdx: number, session: SessionName, count: number, patientStart: number, fromOffset: number) => {
    const date = firstDutyDate(doctorIdx, session, fromOffset)
    if (!date) return null
    const slots = slotsOf(session)
    let added = 0
    for (let i = 0; i < count; i++) {
      const ok = tryAdd({
        patientIdx: patientStart + i,
        doctorIdx,
        date,
        time: slots[i],
        session,
        reason: reasonFor(doctors[doctorIdx]),
        status: 'booked',
      })
      if (ok) added++
    }
    notes.push(`คิวแน่น: ${doctors[doctorIdx].email} วันที่ ${date} ช่วง${session === 'Morning' ? 'เช้า' : 'บ่าย'} มี ${added} คิว`)
    return { doctorIdx, date, count: added }
  }
  const busyMorning = busy(0, 'Morning', 12, 4, 2)
  const busyAfternoon = busy(3, 'Afternoon', 10, 16, 3)

  // --- สถานการณ์ B: ผู้ป่วยที่มีนัดอนาคต 2 รายการ และอีกคนครบจำกัด 3 รายการ ---
  const twoFuturePatientIdx = 0
  const limitReachedPatientIdx = 1
  const addFuture = (patientIdx: number, doctorIdx: number, session: SessionName, fromOffset: number) => {
    const date = firstDutyDate(doctorIdx, session, fromOffset)
    if (date) addRandomSlot(patientIdx, doctorIdx, date, session, 'booked')
  }
  addFuture(twoFuturePatientIdx, 3, 'Morning', 3)
  addFuture(twoFuturePatientIdx, 9, 'Afternoon', 9)
  addFuture(limitReachedPatientIdx, 6, 'Morning', 2)
  addFuture(limitReachedPatientIdx, 9, 'Morning', 5)
  addFuture(limitReachedPatientIdx, 12, 'Afternoon', 11)
  notes.push(`${patients[twoFuturePatientIdx].email} มีนัดอนาคต ${activeFuture[twoFuturePatientIdx]} รายการ`)
  notes.push(`${patients[limitReachedPatientIdx].email} มีนัดอนาคต ${activeFuture[limitReachedPatientIdx]} รายการ (ครบจำกัด)`)

  // --- สถานการณ์ C: นัดที่เหลือเวลาไม่ถึง 2 ชั่วโมง (ทดสอบกฎยกเลิก) ---
  const soonPatientIdx = 2
  let soonFound = false
  outer: for (let di = 0; di < doctors.length; di++) {
    for (const session of sessionsOn(doctors[di], today)) {
      for (const time of slotsOf(session)) {
        const diff = toMin(time) - nowMinutes
        if (diff >= 30 && diff <= 110) {
          if (tryAdd({ patientIdx: soonPatientIdx, doctorIdx: di, date: today, time, session, reason: reasonFor(doctors[di]), status: 'booked' })) {
            notes.push(`นัดที่เหลือเวลาไม่ถึง 2 ชั่วโมง: ${patients[soonPatientIdx].email} วันนี้ ${time}`)
            soonFound = true
            break outer
          }
        }
      }
    }
  }
  if (!soonFound) notes.push('ไม่มีนัดที่เหลือเวลาไม่ถึง 2 ชั่วโมง (รันนอกเวลาออกตรวจ) ให้รัน seed ใหม่ในเวลาทำการเพื่อสร้างนัดนี้')

  // --- นัดย้อนหลัง 30 รายการ: completed / no_show / cancelled ---
  let past = 0
  for (let attempts = 0; past < 30 && attempts < 3000; attempts++) {
    const doctorIdx = Math.floor(rng() * doctors.length)
    const date = addDays(today, -(1 + Math.floor(rng() * 14)))
    const ss = sessionsOn(doctors[doctorIdx], date)
    if (ss.length === 0) continue
    const r = rng()
    const status: ApptStatus = r < 0.7 ? 'completed' : r < 0.85 ? 'no_show' : 'cancelled'
    if (addRandomSlot(Math.floor(rng() * patients.length), doctorIdx, date, pick(ss), status)) past++
  }

  // --- นัดวันนี้ 8 รายการ: สถานะตามเวลาปัจจุบัน ---
  let todayCount = 0
  for (let attempts = 0; todayCount < 8 && attempts < 1000; attempts++) {
    const doctorIdx = Math.floor(rng() * doctors.length)
    const ss = sessionsOn(doctors[doctorIdx], today)
    if (ss.length === 0) continue
    const session = pick(ss)
    const time = pick(slotsOf(session))
    const slot = toMin(time)
    let status: ApptStatus
    if (slot + 30 < nowMinutes) status = rng() < 0.8 ? 'completed' : 'no_show'
    else if (slot <= nowMinutes + 15) status = 'checked_in'
    else status = 'booked'
    const patientIdx = 3 + Math.floor(rng() * (patients.length - 3))
    if (tryAdd({ patientIdx, doctorIdx, date: today, time, session, reason: reasonFor(doctors[doctorIdx]), status })) todayCount++
  }
  if (todayCount === 0) notes.push('วันนี้ไม่มีแพทย์ออกตรวจ จึงไม่มีนัดของวันนี้')

  // --- นัดอนาคตแบบสุ่ม จนครบจำนวนเป้าหมาย (มีนัดที่ถูกยกเลิกปนอยู่ประมาณ 8%) ---
  for (let attempts = 0; appts.length < targetTotal && attempts < 6000; attempts++) {
    const doctorIdx = Math.floor(rng() * doctors.length)
    const date = addDays(today, 1 + Math.floor(rng() * 14))
    const ss = sessionsOn(doctors[doctorIdx], date)
    if (ss.length === 0) continue
    const status: ApptStatus = rng() < 0.08 ? 'cancelled' : 'booked'
    // ผู้ป่วยตั้งแต่ index 3 ขึ้นไป เพื่อไม่ให้ไปรบกวนสถานการณ์ B และ C
    addRandomSlot(3 + Math.floor(rng() * (patients.length - 3)), doctorIdx, date, pick(ss), status)
  }

  return {
    appts,
    notes,
    scenarios: {
      busyMorning,
      busyAfternoon,
      twoFuturePatientIdx,
      limitReachedPatientIdx,
      soonPatientIdx: soonFound ? soonPatientIdx : null,
    },
  }
}
