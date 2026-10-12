'use server'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { fail, ok, toErrorCode, type ActionResult } from '@/lib/errors'
import { emailSchema, phoneSchema } from '@/lib/validation'

const COOKIE = 'reset_token'
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// ตัดตัวที่สับสนง่าย: 0 O 1 l I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
function tempPassword(len = 12) {
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

/** ผู้ป่วยส่งคำขอ: ฝัง token ใน cookie (httpOnly) ฐานข้อมูลเก็บเฉพาะ hash */
export async function requestReset(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema, phone: phoneSchema }).safeParse({
    email: form.get('email'),
    phone: form.get('phone'),
  })
  if (!parsed.success) return fail('VALIDATION')

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  const ipHash = sha256(`ip:${ip}:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}`)
  const token = randomBytes(32).toString('base64url')

  const admin = createAdminClient()
  const { error } = await admin.rpc('create_reset_request', {
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_token_hash: sha256(token),
    p_ip_hash: ipHash,
  })
  if (error) return fail(toErrorCode(error.message))

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  redirect('/forgot-password/status')
}

export type ResetStatus = { status: 'pending' | 'approved' | 'rejected' | 'claimed' | 'expired'; code: string; expiresAt: string } | null

export async function getResetStatus(): Promise<ResetStatus> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null
  const admin = createAdminClient()
  const { data } = await admin.rpc('get_reset_request_status', { p_token_hash: sha256(token) })
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return null
  return { status: row.status, code: row.request_code, expiresAt: row.expires_at }
}

/** กดรับรหัสสำรอง: ต้องมี token ในเบราว์เซอร์นี้ + อนุมัติแล้ว + ยังไม่หมดอายุ แสดงครั้งเดียว */
export async function claimReset(): Promise<ActionResult<{ password: string }>> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return fail('NOT_APPROVED')
  const hash = sha256(token)
  const admin = createAdminClient()

  const { data: userId, error } = await admin.rpc('claim_reset_request', { p_token_hash: hash })
  if (error || !userId) return fail(toErrorCode(error?.message ?? 'NOT_APPROVED'))

  const password = tempPassword()
  const { error: e2 } = await admin.auth.admin.updateUserById(userId as string, { password })
  if (e2) {
    await admin.rpc('revert_reset_claim', { p_token_hash: hash })
    return fail('UNKNOWN')
  }
  store.delete(COOKIE)
  return ok({ password })
}
