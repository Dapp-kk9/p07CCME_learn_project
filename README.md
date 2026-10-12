# ระบบนัดหมายแพทย์ (Next.js + Supabase)

## ตั้งค่าครั้งแรก
1. ใน Supabase SQL Editor รันไฟล์ใน `supabase/migrations/` ตามลำดับ 00 → 05
2. Authentication → Providers → Email: ปิด "Confirm email"
3. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ URL, anon key, service_role key
4. `npm install`
5. `npm run seed -- --yes` สร้างข้อมูลจำลอง (บัญชี `@test.local`, รหัสผ่านเริ่มต้น `Hospital#Test2026`)
6. `npm run dev` แล้วเปิด http://localhost:3000

## บัญชีทดสอบ
| บทบาท | อีเมล |
|---|---|
| admin | admin@test.local |
| แพทย์ | doctor01@test.local … doctor21@test.local |
| เจ้าหน้าที่ | nurse01@test.local … nurse10@test.local |
| ผู้ป่วย | patient01@test.local … patient30@test.local |

## Deploy บน Vercel
- ตั้ง env ทั้ง 3 ตัว (ห้ามใส่ `NEXT_PUBLIC_` หน้า service_role) Region = sin1 (อยู่ใน vercel.json แล้ว)
- ตั้ง Site URL / Redirect URLs ใน Supabase ให้ตรงโดเมน Vercel

## โครงสร้าง
- `src/proxy.ts` ตรวจ session และบทบาท (Next 16 เรียก middleware ว่า proxy)
- `src/actions/` Server Actions (เรียก RPC ด้วยสิทธิ์ผู้ใช้ ยกเว้นสร้างบัญชี/รีเซ็ตรหัสใช้ service_role หลังตรวจ admin)
- `messages/` ข้อความไทย/อังกฤษ
- ก่อนใช้งานจริง ต้องลบบัญชี `@test.local` ทั้งหมด
