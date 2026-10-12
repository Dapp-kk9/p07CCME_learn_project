-- =====================================================
-- 02_functions_triggers.sql
-- ฟังก์ชันช่วย (ใช้ใน RLS) และ trigger
-- รันต่อจาก 01_types_tables.sql
-- =====================================================

-- เวลาปัจจุบันตามเขตเวลาไทย (timestamp ไม่มี timezone)
create or replace function public.bkk_now()
returns timestamp language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Bangkok')
$$;

-- ---------- ฟังก์ชันช่วยสำหรับ RLS (security definer เพื่อกัน recursion) ----------

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.current_doctor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select d.id from public.doctors d where d.user_id = auth.uid()
$$;

create or replace function public.current_patient_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.patients p where p.user_id = auth.uid()
$$;

create or replace function public.staff_clinic_ids()
returns setof smallint language sql stable security definer set search_path = '' as $$
  select cs.clinic_id from public.clinic_staff cs where cs.user_id = auth.uid()
$$;

create or replace function public.doctor_has_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.patient_id = p_patient_id and d.user_id = auth.uid()
  )
$$;

create or replace function public.staff_has_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.appointments a
    join public.clinic_staff cs on cs.clinic_id = a.clinic_id
    where a.patient_id = p_patient_id and cs.user_id = auth.uid()
  )
$$;

-- ---------- สมัครสมาชิก: สร้าง profile (patient เสมอ) + patients อัตโนมัติ ----------
-- อ่านจาก user_metadata เฉพาะ full_name, phone, birth_date เท่านั้น ไม่อ่าน role
-- บัญชีแพทย์/เจ้าหน้าที่/admin: สร้างผ่าน service_role แล้วเปลี่ยน role และลบแถว patients ของบัญชีนั้น

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name  text;
  v_phone text;
  v_birth date;
begin
  v_name := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)), 200);
  v_phone := left(nullif(btrim(new.raw_user_meta_data->>'phone'), ''), 30);
  begin
    v_birth := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  exception when others then
    v_birth := null;
  end;

  insert into public.profiles (id, role, full_name, phone)
  values (new.id, 'patient', v_name, v_phone);

  insert into public.patients (user_id, full_name, phone, birth_date)
  values (new.id, v_name, v_phone, v_birth);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ผู้ป่วยแก้ชื่อ/เบอร์ในตาราง patients แล้วซิงก์ไปที่ profiles
create or replace function public.sync_patient_to_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.full_name is distinct from old.full_name or new.phone is distinct from old.phone then
    update public.profiles set full_name = new.full_name, phone = new.phone where id = new.user_id;
  end if;
  return new;
end $$;

create trigger trg_sync_patient_profile
  after update on public.patients
  for each row execute function public.sync_patient_to_profile();

-- ---------- updated_at ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------- ตรวจเวลานัด: อยู่ในช่วงเช้า/บ่าย และตรงขอบช่อง ----------

create or replace function public.validate_appointment()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_sess public.sessions%rowtype;
  v_slot integer;
begin
  if tg_op = 'INSERT'
     or new.appointment_time is distinct from old.appointment_time
     or new.session_id is distinct from old.session_id then

    select * into v_sess from public.sessions where id = new.session_id;
    if new.appointment_time < v_sess.start_time or new.appointment_time >= v_sess.end_time then
      raise exception 'TIME_OUT_OF_SESSION';
    end if;

    select slot_minutes into v_slot from public.app_settings;
    if mod(extract(epoch from (new.appointment_time - v_sess.start_time))::integer, v_slot * 60) <> 0 then
      raise exception 'TIME_NOT_ON_SLOT';
    end if;
  end if;
  return new;
end $$;

create trigger trg_validate_appointment
  before insert or update on public.appointments
  for each row execute function public.validate_appointment();

-- ---------- ห้ามแพทย์สองคนที่ใช้ห้องเดียวกัน ออกตรวจวันและช่วงเดียวกัน ----------

create or replace function public.check_schedule_room_conflict()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_room smallint;
begin
  select d.room_id into v_room from public.doctors d where d.id = new.doctor_id;

  if exists (
    select 1
    from public.doctor_schedules s
    join public.doctors d on d.id = s.doctor_id
    where s.weekday = new.weekday
      and s.session_id = new.session_id
      and s.doctor_id <> new.doctor_id
      and d.room_id = v_room
      and d.is_active
  ) then
    raise exception 'ROOM_CONFLICT';
  end if;
  return new;
end $$;

create trigger trg_schedule_room_conflict
  before insert or update on public.doctor_schedules
  for each row execute function public.check_schedule_room_conflict();

-- เปลี่ยนห้อง หรือเปิดใช้งานแพทย์อีกครั้ง ต้องไม่ชนกับตารางของแพทย์คนอื่นในห้องนั้น
create or replace function public.check_doctor_room_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_active
     and (new.room_id is distinct from old.room_id or (new.is_active and not old.is_active)) then
    if exists (
      select 1
      from public.doctor_schedules mine
      join public.doctor_schedules other
        on other.weekday = mine.weekday
       and other.session_id = mine.session_id
       and other.doctor_id <> mine.doctor_id
      join public.doctors od on od.id = other.doctor_id
      where mine.doctor_id = new.id
        and od.room_id = new.room_id
        and od.is_active
    ) then
      raise exception 'ROOM_CONFLICT';
    end if;
  end if;
  return new;
end $$;

create trigger trg_doctor_room_change
  before update on public.doctors
  for each row execute function public.check_doctor_room_change();

-- =====================================================
-- สิทธิ์การเรียกฟังก์ชัน
-- =====================================================

-- trigger function: ไม่ให้เรียกผ่าน API
revoke execute on function public.handle_new_user()             from public, anon, authenticated;
revoke execute on function public.sync_patient_to_profile()     from public, anon, authenticated;
revoke execute on function public.set_updated_at()              from public, anon, authenticated;
revoke execute on function public.validate_appointment()        from public, anon, authenticated;
revoke execute on function public.check_schedule_room_conflict() from public, anon, authenticated;
revoke execute on function public.check_doctor_room_change()    from public, anon, authenticated;

-- ฟังก์ชันช่วย: ผู้ล็อกอินเรียกได้ (ใช้ใน RLS)
revoke execute on function public.bkk_now()                     from public, anon;
revoke execute on function public.my_role()                     from public, anon;
revoke execute on function public.is_admin()                    from public, anon;
revoke execute on function public.current_doctor_id()           from public, anon;
revoke execute on function public.current_patient_id()          from public, anon;
revoke execute on function public.staff_clinic_ids()            from public, anon;
revoke execute on function public.doctor_has_patient(uuid)      from public, anon;
revoke execute on function public.staff_has_patient(uuid)       from public, anon;

grant execute on function public.bkk_now()                      to authenticated, service_role;
grant execute on function public.my_role()                      to authenticated, service_role;
grant execute on function public.is_admin()                     to authenticated, service_role;
grant execute on function public.current_doctor_id()            to authenticated, service_role;
grant execute on function public.current_patient_id()           to authenticated, service_role;
grant execute on function public.staff_clinic_ids()             to authenticated, service_role;
grant execute on function public.doctor_has_patient(uuid)       to authenticated, service_role;
grant execute on function public.staff_has_patient(uuid)        to authenticated, service_role;
