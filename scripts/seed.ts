// =====================================================
// scripts/seed.ts
// สร้างข้อมูลจำลองสำหรับทดสอบระบบนัดหมายแพทย์ (DEV เท่านั้น)
//
// ทำอะไร
//   1. ลบบัญชี @test.local เดิมทั้งหมดและแพทย์ของบัญชีเหล่านั้น (ทำซ้ำได้)
//   2. สร้างบัญชีผ่าน Supabase Auth Admin API: admin 1, แพทย์ 21, เจ้าหน้าที่ 10, ผู้ป่วย 30
//   3. ตั้ง role ใน profiles และผูกแพทย์กับห้อง ตารางออกตรวจ เจ้าหน้าที่กับคลินิก
//   4. สร้างนัดหมายจำลอง 80-100 รายการ
//
// วิธีรัน (ต้องรัน 01-05 ใน SQL Editor มาก่อน)
//   npm i -D tsx typescript @supabase/supabase-js
//   npx tsx --env-file=.env.local scripts/seed.ts --yes
//
// ตัวแปรแวดล้อมใน .env.local
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...      (server-only ห้าม commit ห้ามใส่ NEXT_PUBLIC_)
//   SEED_PASSWORD=...                  (ไม่บังคับ รหัสผ่านของบัญชีทดสอบทั้งหมด)
//
// ข้อควรระวัง: ใช้กับ Supabase project dev เท่านั้น
// =====================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  bangkokNow,
  buildAppointments,
  buildDoctors,
  buildNurses,
  buildPatients,
  type ClinicName,
  type SessionName,
} from './seed-data'

const TEST_DOMAIN = '@test.local'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Hospital#Test2026'

type Res<T> = { data: T; error: { message: string } | null }

function must<T>(res: Res<T>, label: string): NonNullable<T> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  return res.data as NonNullable<T>
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function assertServiceKey(key: string): void {
  if (key.startsWith('sb_secret_')) return
  const parts = key.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: string }
      if (payload.role === 'service_role') return
    } catch {
      // ตกไปที่ throw ด้านล่าง
    }
  }
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ไม่ใช่ service_role key (อาจใส่ anon key มาแทน)')
}

async function listAllUsers(sb: SupabaseClient) {
  const out: Array<{ id: string; email?: string | null }> = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    out.push(...data.users)
    if (data.users.length < 1000) break
  }
  return out
}

async function createUser(
  sb: SupabaseClient,
  email: string,
  fullName: string,
  phone: string,
  birthDate?: string,
): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, ...(birthDate ? { birth_date: birthDate } : {}) },
  })
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message ?? 'no user returned'}`)
  return data.user.id
}

async function createUsersInBatches<T extends { email: string }>(
  sb: SupabaseClient,
  items: T[],
  toArgs: (item: T) => { fullName: string; phone: string; birthDate?: string },
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const group of chunk(items, 5)) {
    await Promise.all(
      group.map(async (item) => {
        const a = toArgs(item)
        ids.set(item.email, await createUser(sb, item.email, a.fullName, a.phone, a.birthDate))
      }),
    )
  }
  return ids
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  assertServiceKey(key)

  console.log(`Supabase project: ${new URL(url).host}`)
  if (!process.argv.includes('--yes')) {
    console.log('\nสคริปต์นี้จะ "ลบบัญชี @test.local ทั้งหมด" แล้วสร้างข้อมูลทดสอบใหม่')
    console.log('ใช้กับ project dev เท่านั้น ถ้าถูกต้องให้รันซ้ำพร้อม --yes')
    process.exit(0)
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // ---------- 0) ตรวจว่า migration ถูกรันแล้ว ----------
  const clinicRows = must(await sb.from('clinics').select('id, name_en'), 'อ่าน clinics')
  const sessionRows = must(await sb.from('sessions').select('id, name_en'), 'อ่าน sessions')
  const roomRows = must(await sb.from('exam_rooms').select('id, clinic_id, room_no'), 'อ่าน exam_rooms')
  if (clinicRows.length !== 5 || sessionRows.length !== 2 || roomRows.length !== 18) {
    throw new Error('ข้อมูลอ้างอิงไม่ครบ (ต้องมี 5 คลินิก, 2 ช่วงเวลา, 18 ห้อง) ให้รัน 05_reference_data.sql ก่อน')
  }
  const clinicId = new Map<string, number>(clinicRows.map((r) => [r.name_en as string, r.id as number]))
  const sessionId = new Map<string, number>(sessionRows.map((r) => [r.name_en as string, r.id as number]))
  const roomId = new Map<string, number>(roomRows.map((r) => [`${r.clinic_id}|${r.room_no}`, r.id as number]))
  const roomOf = (clinic: ClinicName, roomNo: number): number => {
    const id = roomId.get(`${clinicId.get(clinic)}|${roomNo}`)
    if (id === undefined) throw new Error(`ไม่พบห้อง ${clinic} #${roomNo}`)
    return id
  }

  // ---------- 1) ล้างข้อมูลทดสอบเดิม ----------
  console.log('\n[1/6] ล้างข้อมูลทดสอบเดิม (@test.local)')
  const existing = await listAllUsers(sb)
  const testUsers = existing.filter((u) => (u.email ?? '').toLowerCase().endsWith(TEST_DOMAIN))
  const others = existing.length - testUsers.length
  if (others > 0) console.log(`      (พบบัญชีอื่นที่ไม่ใช่ ${TEST_DOMAIN} จำนวน ${others} บัญชี จะไม่ถูกแตะต้อง)`)
  if (testUsers.length > 0) {
    const testIds = testUsers.map((u) => u.id)
    const oldDoctors: string[] = []
    for (const ids of chunk(testIds, 100)) {
      const rows = must(await sb.from('doctors').select('id').in('user_id', ids), 'อ่าน doctors เดิม')
      oldDoctors.push(...rows.map((r) => r.id as string))
    }
    for (const u of testUsers) {
      const { error } = await sb.auth.admin.deleteUser(u.id)
      if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`)
    }
    for (const ids of chunk(oldDoctors, 100)) {
      must(await sb.from('doctors').delete().in('id', ids), 'ลบ doctors เดิม')
    }
    console.log(`      ลบบัญชี ${testUsers.length} บัญชี และแพทย์เดิม ${oldDoctors.length} รายการ`)
  }

  // ---------- 2) สร้างบัญชี ----------
  console.log('[2/6] สร้างบัญชีผ่าน Auth Admin API')
  const doctors = buildDoctors()
  const nurses = buildNurses()
  const patients = buildPatients()
  const adminEmail = `admin${TEST_DOMAIN}`

  const adminId = await createUser(sb, adminEmail, 'ผู้ดูแลระบบ (ทดสอบ)', '0800000000')
  const doctorIds = await createUsersInBatches(sb, doctors, (d) => ({ fullName: d.fullName, phone: '0800000001' }))
  const nurseIds = await createUsersInBatches(sb, nurses, (n) => ({ fullName: n.fullName, phone: n.phone }))
  const patientUserIds = await createUsersInBatches(sb, patients, (p) => ({
    fullName: p.fullName,
    phone: p.phone,
    birthDate: p.birthDate,
  }))

  const allIds = [adminId, ...doctorIds.values(), ...nurseIds.values(), ...patientUserIds.values()]
  let profileCount = 0
  for (const ids of chunk(allIds, 100)) {
    const { count, error } = await sb.from('profiles').select('id', { count: 'exact', head: true }).in('id', ids)
    if (error) throw new Error(`ตรวจ profiles: ${error.message}`)
    profileCount += count ?? 0
  }
  if (profileCount !== allIds.length) {
    throw new Error(`trigger on_auth_user_created ไม่ทำงาน (สร้าง ${allIds.length} บัญชี แต่มี profiles ${profileCount}) ให้ตรวจ 02_functions_triggers.sql`)
  }
  console.log(`      สร้างแล้ว: admin 1, แพทย์ ${doctors.length}, เจ้าหน้าที่ ${nurses.length}, ผู้ป่วย ${patients.length}`)

  // ---------- 3) ตั้ง role และลบแถว patients ของบัญชีที่ไม่ใช่ผู้ป่วย ----------
  console.log('[3/6] ตั้งบทบาท (admin / doctor / nurse)')
  must(await sb.from('profiles').update({ role: 'admin' }).eq('id', adminId), 'ตั้ง role admin')
  must(await sb.from('profiles').update({ role: 'doctor' }).in('id', [...doctorIds.values()]), 'ตั้ง role doctor')
  must(await sb.from('profiles').update({ role: 'nurse' }).in('id', [...nurseIds.values()]), 'ตั้ง role nurse')
  const staffUserIds = [adminId, ...doctorIds.values(), ...nurseIds.values()]
  for (const ids of chunk(staffUserIds, 100)) {
    must(await sb.from('patients').delete().in('user_id', ids), 'ลบแถว patients ของบัญชีเจ้าหน้าที่')
  }

  // ---------- 4) แพทย์ ตารางออกตรวจ เจ้าหน้าที่ ----------
  console.log('[4/6] สร้างแพทย์ ตารางออกตรวจ และผูกเจ้าหน้าที่กับคลินิก')
  const doctorRows = doctors.map((d) => ({
    user_id: doctorIds.get(d.email),
    clinic_id: clinicId.get(d.clinic),
    room_id: roomOf(d.clinic, d.roomNo),
    full_name: d.fullName,
    full_name_en: d.fullNameEn,
  }))
  const insertedDoctors = must(await sb.from('doctors').insert(doctorRows).select('id, user_id'), 'สร้าง doctors')
  const doctorDbId = new Map<string, string>(insertedDoctors.map((r) => [r.user_id as string, r.id as string]))
  const doctorIdByIdx = (idx: number): string => {
    const id = doctorDbId.get(doctorIds.get(doctors[idx].email) as string)
    if (!id) throw new Error(`ไม่พบ doctor id ของ ${doctors[idx].email}`)
    return id
  }

  const scheduleRows = doctors.flatMap((d, idx) =>
    d.schedule.map((s) => ({
      doctor_id: doctorIdByIdx(idx),
      weekday: s.weekday,
      session_id: sessionId.get(s.session as SessionName),
    })),
  )
  for (const rows of chunk(scheduleRows, 100)) must(await sb.from('doctor_schedules').insert(rows), 'สร้าง doctor_schedules')

  must(
    await sb.from('clinic_staff').insert(
      nurses.map((n) => ({ user_id: nurseIds.get(n.email), clinic_id: clinicId.get(n.clinic) })),
    ),
    'สร้าง clinic_staff',
  )
  console.log(`      แพทย์ ${doctorRows.length} คน, ตารางออกตรวจ ${scheduleRows.length} รายการ, เจ้าหน้าที่ ${nurses.length} คน`)

  // ---------- 5) ผู้ป่วย: HN ----------
  console.log('[5/6] ตั้ง HN ให้ผู้ป่วยบางคน')
  const patientRows = must(
    await sb.from('patients').select('id, user_id').in('user_id', [...patientUserIds.values()]),
    'อ่าน patients',
  )
  const patientDbId = new Map<string, string>(patientRows.map((r) => [r.user_id as string, r.id as string]))
  let hnCount = 0
  for (const p of patients) {
    if (!p.hn) continue
    must(await sb.from('patients').update({ hn: p.hn }).eq('user_id', patientUserIds.get(p.email) as string), `ตั้ง HN ${p.email}`)
    hnCount++
  }
  console.log(`      มี HN ${hnCount} คน, ยังไม่มี HN ${patients.length - hnCount} คน`)

  // ---------- 6) นัดหมาย ----------
  console.log('[6/6] สร้างนัดหมายจำลอง')
  const now = bangkokNow()
  const plan = buildAppointments(now.date, now.minutes, doctors, patients)
  const nowIso = new Date().toISOString()
  const apptRows = plan.appts.map((a) => {
    const d = doctors[a.doctorIdx]
    const patientUserId = patientUserIds.get(patients[a.patientIdx].email) as string
    const isPast = a.date < now.date
    const row: Record<string, unknown> = {
      patient_id: patientDbId.get(patientUserId),
      clinic_id: clinicId.get(d.clinic),
      doctor_id: doctorIdByIdx(a.doctorIdx),
      room_id: roomOf(d.clinic, d.roomNo),
      session_id: sessionId.get(a.session),
      appointment_date: a.date,
      appointment_time: a.time,
      reason: a.reason,
      status: a.status,
    }
    if (isPast) {
      const created = new Date(`${a.date}T00:00:00Z`)
      created.setUTCDate(created.getUTCDate() - 2)
      row.created_at = created.toISOString()
    }
    if (a.status === 'checked_in' || a.status === 'completed') row.checked_in_at = nowIso
    if (a.status === 'cancelled') {
      row.cancelled_at = nowIso
      row.cancelled_by = patientUserId
      row.cancel_reason = 'ผู้ป่วยแจ้งยกเลิก'
    }
    return row
  })
  for (const rows of chunk(apptRows, 50)) must(await sb.from('appointments').insert(rows, { defaultToNull: false }), 'สร้าง appointments')

  const byStatus = new Map<string, number>()
  for (const a of plan.appts) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1)
  console.log(`      นัดหมายทั้งหมด ${plan.appts.length} รายการ: ${[...byStatus].map(([s, c]) => `${s}=${c}`).join(', ')}`)
  for (const note of plan.notes) console.log(`      - ${note}`)

  // ---------- ตรวจผล ----------
  const { count: apptCount } = await sb.from('appointments').select('id', { count: 'exact', head: true })
  console.log(`\nตรวจผล: appointments ในฐานข้อมูลตอนนี้ ${apptCount} รายการ`)

  console.log('\n=== บัญชีทดสอบ (รหัสผ่านเดียวกันทุกบัญชี) ===')
  console.log(`รหัสผ่าน: ${PASSWORD}`)
  console.log(`admin     : ${adminEmail}`)
  console.log(`แพทย์     : ${doctors[0].email} ... ${doctors[doctors.length - 1].email}  (${doctors[0].fullName} = ${doctors[0].clinic} ห้อง ${doctors[0].roomNo})`)
  console.log(`เจ้าหน้าที่ : ${nurses[0].email} ... ${nurses[nurses.length - 1].email}  (nurse01-02 = Surgery)`)
  console.log(`ผู้ป่วย    : ${patients[0].email} ... ${patients[patients.length - 1].email}`)
  console.log('\nเสร็จแล้ว ก่อนใช้งานจริงต้องลบบัญชี @test.local ทั้งหมด')
}

main().catch((e: unknown) => {
  console.error('\nผิดพลาด:', e instanceof Error ? e.message : e)
  process.exit(1)
})
