-- =====================================================
-- 04_rls.sql
-- Row Level Security และสิทธิ์ระดับตาราง/คอลัมน์
-- รันต่อจาก 03_rpc.sql
--
-- หลักการ
--  * ผู้ใช้ที่ยังไม่ล็อกอิน (anon) ไม่มีสิทธิ์อ่านตารางใด ๆ
--  * การเขียน appointments ทำผ่าน RPC เท่านั้น (ไม่มี insert/update/delete ตรง)
--  * policy ที่อ้างข้ามตารางเรียกผ่านฟังก์ชัน security definer (กัน infinite recursion)
-- =====================================================

alter table public.clinics                 enable row level security;
alter table public.exam_rooms              enable row level security;
alter table public.sessions                enable row level security;
alter table public.profiles                enable row level security;
alter table public.doctors                 enable row level security;
alter table public.patients                enable row level security;
alter table public.clinic_staff            enable row level security;
alter table public.doctor_schedules        enable row level security;
alter table public.schedule_exceptions     enable row level security;
alter table public.app_settings            enable row level security;
alter table public.symptom_keywords        enable row level security;
alter table public.appointments            enable row level security;
alter table public.password_reset_requests enable row level security;

-- ---------- สิทธิ์ระดับตาราง ----------

revoke all on all tables in schema public from anon;

-- appointments: เขียนผ่าน RPC เท่านั้น
revoke insert, update, delete, truncate on public.appointments from authenticated;

-- profiles/patients: ผู้ใช้แก้ได้เฉพาะบางคอลัมน์ (role, must_change_password, hn แก้เองไม่ได้)
revoke insert, update, delete, truncate on public.profiles from authenticated;
revoke insert, update, delete, truncate on public.patients from authenticated;
grant update (full_name, phone)             on public.profiles to authenticated;
grant update (full_name, phone, birth_date) on public.patients to authenticated;

-- ตารางคำขอรีเซ็ตรหัส: ไม่มีสิทธิ์โดยตรงเลย (service_role และฟังก์ชันเท่านั้น)
revoke all on public.password_reset_requests from anon, authenticated;

-- ---------- ข้อมูลอ้างอิง: ผู้ล็อกอินอ่านได้ / admin จัดการได้ ----------

create policy clinics_read on public.clinics for select to authenticated using (true);
create policy clinics_admin on public.clinics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rooms_read on public.exam_rooms for select to authenticated using (true);
create policy rooms_admin on public.exam_rooms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sessions_read on public.sessions for select to authenticated using (true);
create policy sessions_admin on public.sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy schedules_read on public.doctor_schedules for select to authenticated using (true);
create policy schedules_admin on public.doctor_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy exceptions_read on public.schedule_exceptions for select to authenticated using (true);
create policy exceptions_admin on public.schedule_exceptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy keywords_read on public.symptom_keywords for select to authenticated using (true);
create policy keywords_admin on public.symptom_keywords for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- แพทย์: ผู้ป่วยเห็นเฉพาะแพทย์ที่ใช้งานอยู่ บทบาทอื่นเห็นทั้งหมด ----------

create policy doctors_read on public.doctors for select to authenticated
  using (is_active or public.my_role() <> 'patient');
create policy doctors_admin on public.doctors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- profiles ----------

create policy profiles_read_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_read_admin on public.profiles for select to authenticated
  using (public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- clinic_staff ----------

create policy staff_read_own on public.clinic_staff for select to authenticated
  using (user_id = auth.uid());
create policy staff_admin on public.clinic_staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- patients ----------

create policy patients_read_own on public.patients for select to authenticated
  using (user_id = auth.uid());
create policy patients_update_own on public.patients for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy patients_read_doctor on public.patients for select to authenticated
  using (public.doctor_has_patient(id));
create policy patients_read_staff on public.patients for select to authenticated
  using (public.staff_has_patient(id));
create policy patients_read_admin on public.patients for select to authenticated
  using (public.is_admin());

-- ---------- appointments (อ่านอย่างเดียว เขียนผ่าน RPC) ----------

create policy appt_read_patient on public.appointments for select to authenticated
  using (patient_id = public.current_patient_id());
create policy appt_read_doctor on public.appointments for select to authenticated
  using (doctor_id = public.current_doctor_id());
create policy appt_read_staff on public.appointments for select to authenticated
  using (clinic_id in (select public.staff_clinic_ids()));
create policy appt_read_admin on public.appointments for select to authenticated
  using (public.is_admin());

-- password_reset_requests: ไม่มี policy = ปฏิเสธทุกคน (ยกเว้น service_role / security definer)
