-- =====================================================
-- 00_reset_dev.sql        ** ใช้เฉพาะ DEV เท่านั้น **
-- ลบ object ของระบบนัดหมายใน schema public ทั้งหมด เพื่อเริ่มใหม่
-- ห้ามรันใน project ที่มีข้อมูลจริง
-- ไม่แตะ schema auth (ยกเว้น trigger ของระบบนี้บน auth.users)
-- รันซ้ำได้ทุกครั้งที่ต้องการเริ่มใหม่
-- =====================================================

drop trigger if exists on_auth_user_created on auth.users;

drop view if exists public.v_doctor_queue;

drop table if exists
  public.password_reset_requests,
  public.appointments,
  public.schedule_exceptions,
  public.symptom_keywords,
  public.doctor_schedules,
  public.clinic_staff,
  public.app_settings,
  public.patients,
  public.doctors,
  public.exam_rooms,
  public.sessions,
  public.clinics,
  public.profiles
  cascade;

-- ฟังก์ชันของระบบนี้ (ชื่อไม่ซ้ำกัน จึงไม่ต้องระบุ argument)
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.sync_patient_to_profile() cascade;
drop function if exists public.validate_appointment() cascade;
drop function if exists public.check_schedule_room_conflict() cascade;
drop function if exists public.check_doctor_room_change() cascade;
drop function if exists public.bkk_now() cascade;
drop function if exists public.my_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.current_doctor_id() cascade;
drop function if exists public.current_patient_id() cascade;
drop function if exists public.staff_clinic_ids() cascade;
drop function if exists public.doctor_has_patient cascade;
drop function if exists public.staff_has_patient cascade;
drop function if exists public.list_doctors cascade;
drop function if exists public.get_available_slots cascade;
drop function if exists public.book_appointment cascade;
drop function if exists public.cancel_appointment cascade;
drop function if exists public.get_queue_info cascade;
drop function if exists public.update_appointment_status cascade;
drop function if exists public.set_patient_hn cascade;
drop function if exists public.expire_reset_requests() cascade;
drop function if exists public.create_reset_request cascade;
drop function if exists public.list_reset_requests() cascade;
drop function if exists public.approve_reset_request cascade;
drop function if exists public.reject_reset_request cascade;
drop function if exists public.claim_reset_request cascade;
drop function if exists public.revert_reset_claim cascade;
drop function if exists public.get_reset_request_status cascade;

drop type if exists public.reset_request_status cascade;
drop type if exists public.appointment_status cascade;
drop type if exists public.user_role cascade;
