-- =====================================================
-- 03_rpc.sql
-- ฟังก์ชัน RPC สำหรับจอง/ยกเลิก/คิว/สถานะ/HN และขั้นตอนรีเซ็ตรหัสผ่าน
-- รันต่อจาก 02_functions_triggers.sql
--
-- รหัส error (raise exception 'CODE') ให้ frontend แมปเป็นข้อความ 2 ภาษา:
--   NOT_AUTHENTICATED, NOT_A_PATIENT, FORBIDDEN, NOT_FOUND, INVALID_INPUT,
--   DOCTOR_NOT_FOUND, REASON_REQUIRED, REASON_TOO_LONG, TIME_OUT_OF_SESSION,
--   TIME_NOT_ON_SLOT, NOT_ON_DUTY, DOCTOR_UNAVAILABLE, TOO_LATE, TOO_FAR,
--   LIMIT_REACHED, PATIENT_TIME_CONFLICT, SLOT_TAKEN, MUST_CHANGE_PASSWORD,
--   TOO_LATE_TO_CANCEL, INVALID_TRANSITION, USE_CANCEL_APPOINTMENT,
--   NOT_APPOINTMENT_DAY, TOO_EARLY_FOR_NO_SHOW, HN_EMPTY, HN_TAKEN,
--   RATE_LIMITED, REQUEST_NOT_PENDING, NO_MATCHING_ACCOUNT, NOT_PATIENT_ACCOUNT,
--   NOT_APPROVED
-- =====================================================

-- ---------- รายชื่อแพทย์ + ตารางออกตรวจ (ใช้สิทธิ์ของผู้เรียก ผ่าน RLS) ----------

create or replace function public.list_doctors(p_clinic_id smallint default null)
returns table (
  doctor_id    uuid,
  clinic_id    smallint,
  room_id      smallint,
  room_no      smallint,
  full_name    text,
  full_name_en text,
  schedules    jsonb
)
language sql stable security invoker set search_path = '' as $$
  select
    d.id, d.clinic_id, d.room_id, r.room_no, d.full_name, d.full_name_en,
    coalesce((
      select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'session_id', s.session_id)
                       order by s.weekday, s.session_id)
      from public.doctor_schedules s
      where s.doctor_id = d.id
    ), '[]'::jsonb)
  from public.doctors d
  join public.exam_rooms r on r.id = d.room_id
  where d.is_active
    and (p_clinic_id is null or d.clinic_id = p_clinic_id)
  order by d.full_name
$$;

-- ---------- ช่องเวลาของแพทย์ในวันที่เลือก ----------
-- คืนสถานะว่าง/ไม่ว่าง และจำนวนคิวก่อนหน้าช่องนั้น โดยไม่เปิดเผยข้อมูลผู้ป่วยอื่น

create or replace function public.get_available_slots(p_doctor_id uuid, p_date date)
returns table (
  slot_time    time,
  session_id   smallint,
  is_taken     boolean,
  is_bookable  boolean,
  queue_ahead  integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_set public.app_settings%rowtype;
  v_now timestamp := public.bkk_now();
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_doctor_id is null or p_date is null then raise exception 'INVALID_INPUT'; end if;

  select * into v_set from public.app_settings;

  if not exists (select 1 from public.doctors d where d.id = p_doctor_id and d.is_active) then
    raise exception 'DOCTOR_NOT_FOUND';
  end if;

  return query
  with sess as (
    select s.id as sid, s.start_time as st, s.end_time as et
    from public.sessions s
    where exists (
            select 1 from public.doctor_schedules ds
            where ds.doctor_id = p_doctor_id
              and ds.weekday = extract(isodow from p_date)::smallint
              and ds.session_id = s.id)
      and not exists (
            select 1 from public.schedule_exceptions e
            where e.doctor_id = p_doctor_id
              and e.date = p_date
              and (e.session_id is null or e.session_id = s.id))
  ),
  slots as (
    select sess.sid as sid,
           (sess.st + make_interval(mins => g * v_set.slot_minutes))::time as t
    from sess,
         generate_series(0, (extract(epoch from (sess.et - sess.st))::integer / 60) / v_set.slot_minutes - 1) as g
  )
  select
    sl.t,
    sl.sid,
    exists (
      select 1 from public.appointments a
      where a.doctor_id = p_doctor_id
        and a.appointment_date = p_date
        and a.appointment_time = sl.t
        and a.status <> 'cancelled'),
    ((p_date + sl.t) >= v_now + make_interval(hours => v_set.cancel_min_hours)
       and p_date <= v_now::date + v_set.booking_days_ahead),
    (select count(*)::integer from public.appointments a
      where a.doctor_id = p_doctor_id
        and a.appointment_date = p_date
        and a.session_id = sl.sid
        and a.appointment_time < sl.t
        and a.status in ('booked', 'checked_in'))
  from slots sl
  order by sl.t;
end $$;

-- ---------- จองนัด ----------

create or replace function public.book_appointment(
  p_doctor_id uuid,
  p_date      date,
  p_time      time,
  p_reason    text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_patient    uuid;
  v_doc        public.doctors%rowtype;
  v_set        public.app_settings%rowtype;
  v_sess       public.sessions%rowtype;
  v_now        timestamp := public.bkk_now();
  v_reason     text;
  v_active     integer;
  v_id         uuid;
  v_constraint text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_doctor_id is null or p_date is null or p_time is null then raise exception 'INVALID_INPUT'; end if;

  if public.my_role() is distinct from 'patient' then raise exception 'NOT_A_PATIENT'; end if;
  select id into v_patient from public.patients where user_id = v_uid;
  if v_patient is null then raise exception 'NOT_A_PATIENT'; end if;

  -- กันจองพร้อมกันหลายรายการจนเกินจำนวนที่กำหนด
  perform pg_advisory_xact_lock(hashtextextended(v_patient::text, 0));

  if exists (select 1 from public.profiles where id = v_uid and must_change_password) then
    raise exception 'MUST_CHANGE_PASSWORD';
  end if;

  select * into v_set from public.app_settings;

  v_reason := btrim(coalesce(p_reason, ''));
  if char_length(v_reason) = 0 then raise exception 'REASON_REQUIRED'; end if;
  if char_length(v_reason) > 500 then raise exception 'REASON_TOO_LONG'; end if;

  select * into v_doc from public.doctors where id = p_doctor_id and is_active;
  if not found then raise exception 'DOCTOR_NOT_FOUND'; end if;

  select * into v_sess from public.sessions where p_time >= start_time and p_time < end_time;
  if not found then raise exception 'TIME_OUT_OF_SESSION'; end if;

  if mod(extract(epoch from (p_time - v_sess.start_time))::integer, v_set.slot_minutes * 60) <> 0 then
    raise exception 'TIME_NOT_ON_SLOT';
  end if;

  if not exists (
    select 1 from public.doctor_schedules ds
    where ds.doctor_id = p_doctor_id
      and ds.weekday = extract(isodow from p_date)::smallint
      and ds.session_id = v_sess.id
  ) then
    raise exception 'NOT_ON_DUTY';
  end if;

  if exists (
    select 1 from public.schedule_exceptions e
    where e.doctor_id = p_doctor_id
      and e.date = p_date
      and (e.session_id is null or e.session_id = v_sess.id)
  ) then
    raise exception 'DOCTOR_UNAVAILABLE';
  end if;

  if (p_date + p_time) < v_now + make_interval(hours => v_set.cancel_min_hours) then
    raise exception 'TOO_LATE';
  end if;
  if p_date > v_now::date + v_set.booking_days_ahead then
    raise exception 'TOO_FAR';
  end if;

  select count(*) into v_active
  from public.appointments a
  where a.patient_id = v_patient
    and a.status in ('booked', 'checked_in')
    and (a.appointment_date + a.appointment_time) >= v_now;
  if v_active >= v_set.max_active_appointments then raise exception 'LIMIT_REACHED'; end if;

  if exists (
    select 1 from public.appointments a
    where a.patient_id = v_patient
      and a.appointment_date = p_date
      and a.appointment_time = p_time
      and a.status <> 'cancelled'
  ) then
    raise exception 'PATIENT_TIME_CONFLICT';
  end if;

  begin
    insert into public.appointments
      (patient_id, clinic_id, doctor_id, room_id, session_id, appointment_date, appointment_time, reason)
    values
      (v_patient, v_doc.clinic_id, v_doc.id, v_doc.room_id, v_sess.id, p_date, p_time, v_reason)
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_patient_slot' then raise exception 'PATIENT_TIME_CONFLICT'; end if;
    raise exception 'SLOT_TAKEN';
  end;

  return v_id;
end $$;

-- ---------- ยกเลิกนัด ----------
-- ผู้ป่วย: เฉพาะนัดของตนเอง สถานะ booked และเหลือเวลาอย่างน้อย cancel_min_hours
-- nurse (คลินิกที่สังกัด) และ admin: ยกเลิกได้ทุกเวลา (นัดที่ยังไม่จบ)

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.user_role := public.my_role();
  v_a    public.appointments%rowtype;
  v_set  public.app_settings%rowtype;
  v_now  timestamp := public.bkk_now();
begin
  if v_uid is null or v_role is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_a from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  select * into v_set from public.app_settings;

  if v_role = 'patient' then
    if v_a.patient_id is distinct from public.current_patient_id() then raise exception 'NOT_FOUND'; end if;
    if v_a.status <> 'booked' then raise exception 'INVALID_TRANSITION'; end if;
    if (v_a.appointment_date + v_a.appointment_time) < v_now + make_interval(hours => v_set.cancel_min_hours) then
      raise exception 'TOO_LATE_TO_CANCEL';
    end if;
  elsif v_role = 'nurse' then
    if not exists (select 1 from public.clinic_staff cs where cs.user_id = v_uid and cs.clinic_id = v_a.clinic_id) then
      raise exception 'FORBIDDEN';
    end if;
    if v_a.status not in ('booked', 'checked_in') then raise exception 'INVALID_TRANSITION'; end if;
  elsif v_role = 'admin' then
    if v_a.status not in ('booked', 'checked_in') then raise exception 'INVALID_TRANSITION'; end if;
  else
    raise exception 'FORBIDDEN';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
  where id = v_a.id;
end $$;

-- ---------- จำนวนคิวก่อนหน้า (เฉพาะตัวเลข) ----------

create or replace function public.get_queue_info(p_appointment_id uuid)
returns table (queue_ahead integer, queue_no integer, total_active integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_role  public.user_role := public.my_role();
  v_a     public.appointments%rowtype;
  v_ahead integer;
  v_total integer;
begin
  if v_uid is null or v_role is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_a from public.appointments where id = p_appointment_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_role = 'patient' then
    if v_a.patient_id is distinct from public.current_patient_id() then raise exception 'NOT_FOUND'; end if;
  elsif v_role = 'doctor' then
    if not exists (select 1 from public.doctors d where d.id = v_a.doctor_id and d.user_id = v_uid) then
      raise exception 'FORBIDDEN';
    end if;
  elsif v_role = 'nurse' then
    if not exists (select 1 from public.clinic_staff cs where cs.user_id = v_uid and cs.clinic_id = v_a.clinic_id) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select count(*)::integer into v_ahead
  from public.appointments a
  where a.doctor_id = v_a.doctor_id
    and a.appointment_date = v_a.appointment_date
    and a.session_id = v_a.session_id
    and a.appointment_time < v_a.appointment_time
    and a.status in ('booked', 'checked_in');

  select count(*)::integer into v_total
  from public.appointments a
  where a.doctor_id = v_a.doctor_id
    and a.appointment_date = v_a.appointment_date
    and a.session_id = v_a.session_id
    and a.status in ('booked', 'checked_in');

  return query select v_ahead, v_ahead + 1, v_total;
end $$;

-- ---------- เปลี่ยนสถานะนัด (เช็กอิน / ไม่มา / ตรวจเสร็จ) ----------
-- booked -> checked_in      : nurse (คลินิกที่สังกัด), admin (เฉพาะวันนัด)
-- booked -> no_show         : nurse, admin (หลังเวลานัด)
-- checked_in -> completed   : doctor (นัดของตนเอง), admin
-- การยกเลิกใช้ cancel_appointment

create or replace function public.update_appointment_status(
  p_appointment_id uuid,
  p_new_status     public.appointment_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.user_role := public.my_role();
  v_a    public.appointments%rowtype;
  v_now  timestamp := public.bkk_now();
begin
  if v_uid is null or v_role is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_a from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_new_status = 'cancelled' then raise exception 'USE_CANCEL_APPOINTMENT'; end if;

  if v_role = 'nurse' then
    if not exists (select 1 from public.clinic_staff cs where cs.user_id = v_uid and cs.clinic_id = v_a.clinic_id) then
      raise exception 'FORBIDDEN';
    end if;
  elsif v_role = 'doctor' then
    if not exists (select 1 from public.doctors d where d.id = v_a.doctor_id and d.user_id = v_uid) then
      raise exception 'FORBIDDEN';
    end if;
  elsif v_role <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  if v_a.status = 'booked' and p_new_status = 'checked_in' and v_role in ('nurse', 'admin') then
    if v_a.appointment_date <> v_now::date then raise exception 'NOT_APPOINTMENT_DAY'; end if;
    update public.appointments set status = 'checked_in', checked_in_at = now() where id = v_a.id;

  elsif v_a.status = 'booked' and p_new_status = 'no_show' and v_role in ('nurse', 'admin') then
    if (v_a.appointment_date + v_a.appointment_time) > v_now then raise exception 'TOO_EARLY_FOR_NO_SHOW'; end if;
    update public.appointments set status = 'no_show' where id = v_a.id;

  elsif v_a.status = 'checked_in' and p_new_status = 'completed' and v_role in ('doctor', 'admin') then
    update public.appointments set status = 'completed' where id = v_a.id;

  else
    raise exception 'INVALID_TRANSITION';
  end if;
end $$;

-- ---------- กรอก HN ----------

create or replace function public.set_patient_hn(p_patient_id uuid, p_hn text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_hn text := btrim(coalesce(p_hn, ''));
begin
  if auth.uid() is null or public.my_role() not in ('nurse', 'admin') then raise exception 'FORBIDDEN'; end if;
  if char_length(v_hn) = 0 or char_length(v_hn) > 30 then raise exception 'HN_EMPTY'; end if;

  begin
    update public.patients set hn = v_hn where id = p_patient_id;
  exception when unique_violation then
    raise exception 'HN_TAKEN';
  end;

  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- =====================================================
-- ขั้นตอนลืมรหัสผ่าน: ขอ -> อนุมัติ -> รับ
-- ฟังก์ชันที่ผู้ป่วยใช้ (ไม่ได้ล็อกอิน) เรียกผ่าน server action ด้วย service_role เท่านั้น
-- Next.js เป็นผู้สร้าง token สุ่ม, เก็บ token ใน cookie (httpOnly) และส่งเฉพาะ hash มาที่ฐานข้อมูล
-- =====================================================

create or replace function public.expire_reset_requests()
returns void language sql security definer set search_path = '' as $$
  update public.password_reset_requests
  set status = 'expired'
  where (status = 'pending'  and created_at < now() - interval '24 hours')
     or (status = 'approved' and expires_at < now())
$$;

-- ส่งคำขอ: คืนรหัสคำขอ 6 หลักเสมอ ไม่ว่าอีเมลมีในระบบหรือไม่ (กันการเดาอีเมล)
create or replace function public.create_reset_request(
  p_email       text,
  p_phone       text,
  p_token_hash  text,
  p_ip_hash     text default null
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_uid    uuid;
  v_role   public.user_role;
  v_status public.reset_request_status;
  v_code   text;
begin
  if char_length(v_email) not between 3 and 254 then raise exception 'INVALID_INPUT'; end if;
  if p_token_hash is null or char_length(p_token_hash) < 32 then raise exception 'INVALID_INPUT'; end if;

  if p_ip_hash is not null and (
       select count(*) from public.password_reset_requests r
       where r.requester_ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour'
     ) >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is not null then
    select p.role into v_role from public.profiles p where p.id = v_uid;
  end if;

  -- บัญชีแพทย์/เจ้าหน้าที่/admin ขอเองไม่ได้ (ปฏิเสธอัตโนมัติ)
  v_status := case when v_uid is not null and v_role is distinct from 'patient' then 'rejected' else 'pending' end;
  v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');

  insert into public.password_reset_requests
    (user_id, email_entered, phone_entered, request_code, claim_token_hash, requester_ip_hash, status)
  values
    (v_uid, v_email, left(nullif(btrim(coalesce(p_phone, '')), ''), 30), v_code, p_token_hash, p_ip_hash, v_status);

  return v_code;
end $$;

-- ดูสถานะคำขอของเบราว์เซอร์ที่ถือ token
create or replace function public.get_reset_request_status(p_token_hash text)
returns table (status public.reset_request_status, request_code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_reset_requests();
  return query
    select r.status, r.request_code, r.expires_at
    from public.password_reset_requests r
    where r.claim_token_hash = p_token_hash;
end $$;

-- รายการคำขอที่รอตรวจ/รอรับ สำหรับ nurse และ admin
create or replace function public.list_reset_requests()
returns table (
  id                uuid,
  status            public.reset_request_status,
  request_code      text,
  email_entered     text,
  phone_entered     text,
  matched           boolean,
  account_full_name text,
  account_phone     text,
  created_at        timestamptz,
  expires_at        timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.my_role() not in ('nurse', 'admin') then raise exception 'FORBIDDEN'; end if;
  perform public.expire_reset_requests();
  return query
    select r.id, r.status, r.request_code, r.email_entered, r.phone_entered,
           (r.user_id is not null), p.full_name, p.phone, r.created_at, r.expires_at
    from public.password_reset_requests r
    left join public.profiles p on p.id = r.user_id
    where r.status in ('pending', 'approved')
    order by r.created_at;
end $$;

-- อนุมัติ: ยังไม่เปลี่ยนรหัสผ่านจริง แค่เปิดสิทธิ์ให้กดรับภายใน 30 นาที
create or replace function public.approve_reset_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_r    public.password_reset_requests%rowtype;
  v_role public.user_role;
begin
  if auth.uid() is null or public.my_role() not in ('nurse', 'admin') then raise exception 'FORBIDDEN'; end if;

  select * into v_r from public.password_reset_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_r.status <> 'pending' or v_r.created_at < now() - interval '24 hours' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;
  if v_r.user_id is null then raise exception 'NO_MATCHING_ACCOUNT'; end if;

  select p.role into v_role from public.profiles p where p.id = v_r.user_id;
  if v_role is distinct from 'patient' then raise exception 'NOT_PATIENT_ACCOUNT'; end if;

  update public.password_reset_requests
  set status = 'approved', approved_by = auth.uid(), approved_at = now(),
      expires_at = now() + interval '30 minutes'
  where id = v_r.id;
end $$;

create or replace function public.reject_reset_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_r public.password_reset_requests%rowtype;
begin
  if auth.uid() is null or public.my_role() not in ('nurse', 'admin') then raise exception 'FORBIDDEN'; end if;

  select * into v_r from public.password_reset_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_r.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;

  update public.password_reset_requests
  set status = 'rejected', approved_by = auth.uid(), approved_at = now()
  where id = v_r.id;
end $$;

-- ผู้ป่วยกดรับ: ใช้ได้ครั้งเดียว ต้องอนุมัติแล้วและยังไม่หมดอายุ
-- ฟังก์ชันนี้ "จอง" สิทธิ์และคืน user_id ให้ server ไปตั้งรหัสผ่านสำรองผ่าน Auth Admin API
-- ถ้าตั้งรหัสไม่สำเร็จ ให้เรียก revert_reset_claim
create or replace function public.claim_reset_request(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_r public.password_reset_requests%rowtype;
begin
  perform public.expire_reset_requests();

  select * into v_r from public.password_reset_requests
  where claim_token_hash = p_token_hash for update;
  if not found or v_r.status <> 'approved' or v_r.user_id is null then
    raise exception 'NOT_APPROVED';
  end if;

  update public.password_reset_requests set status = 'claimed', claimed_at = now() where id = v_r.id;
  update public.profiles set must_change_password = true where id = v_r.user_id;

  -- ยกเลิกคำขออื่นที่ค้างอยู่ของบัญชีเดียวกัน
  update public.password_reset_requests
  set status = 'expired'
  where user_id = v_r.user_id and id <> v_r.id and status in ('pending', 'approved');

  return v_r.user_id;
end $$;

create or replace function public.revert_reset_claim(p_token_hash text)
returns void language sql security definer set search_path = '' as $$
  update public.password_reset_requests
  set status = 'approved', claimed_at = null
  where claim_token_hash = p_token_hash and status = 'claimed'
$$;

-- =====================================================
-- สิทธิ์การเรียกฟังก์ชัน
-- =====================================================

-- ผู้ล็อกอินเรียกได้
revoke execute on function public.list_doctors(smallint)                              from public, anon;
revoke execute on function public.get_available_slots(uuid, date)                     from public, anon;
revoke execute on function public.book_appointment(uuid, date, time, text)            from public, anon;
revoke execute on function public.cancel_appointment(uuid, text)                      from public, anon;
revoke execute on function public.get_queue_info(uuid)                                from public, anon;
revoke execute on function public.update_appointment_status(uuid, public.appointment_status) from public, anon;
revoke execute on function public.set_patient_hn(uuid, text)                          from public, anon;
revoke execute on function public.list_reset_requests()                               from public, anon;
revoke execute on function public.approve_reset_request(uuid)                         from public, anon;
revoke execute on function public.reject_reset_request(uuid)                          from public, anon;

grant execute on function public.list_doctors(smallint)                               to authenticated;
grant execute on function public.get_available_slots(uuid, date)                      to authenticated;
grant execute on function public.book_appointment(uuid, date, time, text)             to authenticated;
grant execute on function public.cancel_appointment(uuid, text)                       to authenticated;
grant execute on function public.get_queue_info(uuid)                                 to authenticated;
grant execute on function public.update_appointment_status(uuid, public.appointment_status) to authenticated;
grant execute on function public.set_patient_hn(uuid, text)                           to authenticated;
grant execute on function public.list_reset_requests()                                to authenticated;
grant execute on function public.approve_reset_request(uuid)                          to authenticated;
grant execute on function public.reject_reset_request(uuid)                           to authenticated;

-- service_role เท่านั้น (เรียกจาก server action ฝั่ง Next.js)
revoke execute on function public.expire_reset_requests()                             from public, anon, authenticated;
revoke execute on function public.create_reset_request(text, text, text, text)        from public, anon, authenticated;
revoke execute on function public.get_reset_request_status(text)                      from public, anon, authenticated;
revoke execute on function public.claim_reset_request(text)                           from public, anon, authenticated;
revoke execute on function public.revert_reset_claim(text)                            from public, anon, authenticated;

grant execute on function public.expire_reset_requests()                              to service_role;
grant execute on function public.create_reset_request(text, text, text, text)         to service_role;
grant execute on function public.get_reset_request_status(text)                       to service_role;
grant execute on function public.claim_reset_request(text)                            to service_role;
grant execute on function public.revert_reset_claim(text)                             to service_role;

-- ---------- View สำหรับแพทย์/เจ้าหน้าที่: คิวตรวจ ----------
-- security_invoker = true เพื่อให้ RLS ของผู้เรียกทำงาน

create or replace view public.v_doctor_queue
with (security_invoker = true) as
select
  a.id               as appointment_id,
  a.doctor_id,
  a.clinic_id,
  a.room_id,
  r.room_no,
  a.appointment_date,
  a.session_id,
  s.name             as session_name,
  s.name_en          as session_name_en,
  a.appointment_time,
  a.patient_id,
  p.full_name        as patient_name,
  p.hn,
  a.reason,
  a.status,
  count(*) over (partition by a.doctor_id, a.appointment_date)                  as total_patients_today,
  count(*) over (partition by a.doctor_id, a.appointment_date, a.session_id)    as total_patients_in_session
from public.appointments a
join public.patients   p on p.id = a.patient_id
join public.sessions   s on s.id = a.session_id
join public.exam_rooms r on r.id = a.room_id
where a.status <> 'cancelled';

revoke all on public.v_doctor_queue from anon;
grant select on public.v_doctor_queue to authenticated;
