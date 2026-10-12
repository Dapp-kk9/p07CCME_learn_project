-- =====================================================
-- 01_types_tables.sql
-- enum และตารางทั้งหมดของระบบนัดหมายแพทย์
-- รันต่อจาก 00_reset_dev.sql
-- =====================================================

create type public.user_role as enum ('patient', 'doctor', 'nurse', 'admin');
create type public.appointment_status as enum ('booked', 'checked_in', 'completed', 'cancelled', 'no_show');
create type public.reset_request_status as enum ('pending', 'approved', 'rejected', 'claimed', 'expired');

-- ---------- ข้อมูลอ้างอิง ----------

create table public.clinics (
  id       smallint generated always as identity primary key,
  name     text not null unique,        -- ภาษาไทย
  name_en  text not null unique
);

create table public.exam_rooms (
  id         smallint generated always as identity primary key,
  clinic_id  smallint not null references public.clinics(id) on delete restrict,
  room_no    smallint not null check (room_no > 0),
  name       text not null,             -- ภาษาไทย
  name_en    text not null,
  unique (clinic_id, room_no),
  unique (id, clinic_id)                -- ใช้เป็นเป้าหมายของ composite FK
);

create table public.sessions (
  id          smallint generated always as identity primary key,
  name        text not null unique,     -- เช้า / บ่าย
  name_en     text not null unique,
  start_time  time not null,
  end_time    time not null,
  check (start_time < end_time)
);

-- ---------- ผู้ใช้ ----------

-- บทบาทของผู้ใช้ทุกคน (แหล่งความจริงเดียวของ role ห้ามอ่านจาก user_metadata)
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  public.user_role not null default 'patient',
  full_name             text not null check (char_length(btrim(full_name)) between 1 and 200),
  phone                 text,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now()
);

create table public.doctors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete set null,
  clinic_id    smallint not null references public.clinics(id) on delete restrict,
  room_id      smallint not null,       -- แพทย์ประจำห้องตายตัว
  full_name    text not null check (char_length(btrim(full_name)) between 1 and 200),
  full_name_en text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (room_id, clinic_id) references public.exam_rooms(id, clinic_id)
);

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  hn          text unique,              -- เจ้าหน้าที่กรอกให้เมื่อผู้ป่วยมาแจ้งที่โรงพยาบาล
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 200),
  phone       text,
  birth_date  date,
  created_at  timestamptz not null default now()
);

-- เจ้าหน้าที่หน้าห้องตรวจ ผูกกับคลินิก (เห็นทุกห้องในคลินิกนั้น)
create table public.clinic_staff (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  clinic_id  smallint not null references public.clinics(id) on delete cascade,
  primary key (user_id, clinic_id)
);

-- ---------- ตารางออกตรวจ ----------

create table public.doctor_schedules (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),  -- 1 = จันทร์ ... 7 = อาทิตย์ (ISO)
  session_id  smallint not null references public.sessions(id) on delete restrict,
  unique (doctor_id, weekday, session_id)
);

-- วันลา/วันหยุด (session_id ว่าง = ทั้งวัน)
create table public.schedule_exceptions (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  date        date not null,
  session_id  smallint references public.sessions(id) on delete cascade,
  reason      text
);
create index idx_exceptions_doctor_date on public.schedule_exceptions (doctor_id, date);

-- ---------- การตั้งค่าระบบ (แถวเดียว) ----------

create table public.app_settings (
  id                       boolean primary key default true check (id),
  slot_minutes             integer not null default 15 check (slot_minutes between 5 and 120),
  max_active_appointments  integer not null default 3  check (max_active_appointments between 1 and 20),
  cancel_min_hours         integer not null default 2  check (cancel_min_hours >= 0),
  booking_days_ahead       integer not null default 30 check (booking_days_ahead between 1 and 365),
  updated_at               timestamptz not null default now()
);
insert into public.app_settings default values;

-- ---------- คำแนะนำคลินิกจากอาการ (ไม่ใช่การวินิจฉัย) ----------

create table public.symptom_keywords (
  id          integer generated always as identity primary key,
  clinic_id   smallint not null references public.clinics(id) on delete cascade,
  keyword_th  text not null,
  keyword_en  text not null
);

-- ---------- การนัดหมาย ----------

create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients(id) on delete cascade,
  clinic_id         smallint not null,
  doctor_id         uuid not null,
  room_id           smallint not null,
  session_id        smallint not null references public.sessions(id) on delete restrict,
  appointment_date  date not null,
  appointment_time  time not null,
  reason            text not null check (char_length(btrim(reason)) between 1 and 500),
  status            public.appointment_status not null default 'booked',
  checked_in_at     timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users(id) on delete set null,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- แพทย์และห้องต้องอยู่คลินิกเดียวกับที่นัด
  foreign key (doctor_id, clinic_id) references public.doctors(id, clinic_id),
  foreign key (room_id,   clinic_id) references public.exam_rooms(id, clinic_id)
);

-- กันนัดซ้ำ (ไม่นับนัดที่ยกเลิก)
create unique index uq_doctor_slot  on public.appointments (doctor_id,  appointment_date, appointment_time) where status <> 'cancelled';
create unique index uq_room_slot    on public.appointments (room_id,    appointment_date, appointment_time) where status <> 'cancelled';
create unique index uq_patient_slot on public.appointments (patient_id, appointment_date, appointment_time) where status <> 'cancelled';

create index idx_appt_doctor_date  on public.appointments (doctor_id, appointment_date);
create index idx_appt_clinic_date  on public.appointments (clinic_id, appointment_date);
create index idx_appt_patient      on public.appointments (patient_id);

-- ---------- คำขอรีเซ็ตรหัสผ่าน (ขอ -> อนุมัติ -> รับ) ----------
-- ไม่เก็บรหัสผ่านสำรองในตารางนี้ รหัสถูกสร้างตอนผู้ป่วยกดรับ
-- เข้าถึงได้ผ่านฟังก์ชัน/service_role เท่านั้น (ดู 04_rls.sql)

create table public.password_reset_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete cascade,  -- ว่าง = ไม่พบอีเมลนี้
  email_entered      text not null,
  phone_entered      text,
  request_code       text not null,            -- รหัสคำขอ 6 หลัก ให้ผู้ป่วยแจ้งเจ้าหน้าที่
  claim_token_hash   text not null unique,     -- SHA-256 ของ token ที่ฝังในเบราว์เซอร์ผู้ขอ
  requester_ip_hash  text,                     -- ใช้จำกัดอัตราเท่านั้น ไม่เก็บ IP จริง
  status             public.reset_request_status not null default 'pending',
  created_at         timestamptz not null default now(),
  approved_by        uuid references public.profiles(id) on delete set null,  -- ผู้อนุมัติหรือปฏิเสธ
  approved_at        timestamptz,
  expires_at         timestamptz,              -- เวลาหมดอายุของสิทธิ์กดรับ (หลังอนุมัติ 30 นาที)
  claimed_at         timestamptz
);
create index idx_reset_status_created on public.password_reset_requests (status, created_at);
create index idx_reset_ip_created     on public.password_reset_requests (requester_ip_hash, created_at);
create index idx_reset_user           on public.password_reset_requests (user_id);
