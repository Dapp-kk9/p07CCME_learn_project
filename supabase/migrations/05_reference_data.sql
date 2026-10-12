-- =====================================================
-- 05_reference_data.sql
-- ข้อมูลอ้างอิง: คลินิก, ช่วงเวลา, ห้องตรวจ 18 ห้อง, keyword อาการ
-- (app_settings ถูกสร้างค่าเริ่มต้นไว้แล้วใน 01)
-- รันต่อจาก 04_rls.sql
-- บัญชีผู้ใช้ แพทย์ นัดจำลอง จะสร้างด้วย seed script (เฟส 2)
-- =====================================================

insert into public.clinics (name, name_en) values
  ('ศัลยกรรม',    'Surgery'),
  ('อายุรกรรม',   'Internal Medicine'),
  ('โรคตา',       'Ophthalmology'),
  ('โรคหูคอจมูก', 'ENT'),
  ('โรคผิวหนัง',  'Dermatology');

insert into public.sessions (name, name_en, start_time, end_time) values
  ('เช้า', 'Morning',   '08:30', '12:00'),
  ('บ่าย', 'Afternoon', '13:00', '16:30');

-- ห้องตรวจ: ศัลยกรรม 5, อายุรกรรม 5, โรคตา 3, โรคหูคอจมูก 3, โรคผิวหนัง 2
insert into public.exam_rooms (clinic_id, room_no, name, name_en)
select c.id, n::smallint, 'ห้องตรวจ ' || n, 'Room ' || n
from public.clinics c
join (values
  ('ศัลยกรรม', 5),
  ('อายุรกรรม', 5),
  ('โรคตา', 3),
  ('โรคหูคอจมูก', 3),
  ('โรคผิวหนัง', 2)
) as v(cname, cnt) on v.cname = c.name
cross join lateral generate_series(1, v.cnt) as n;

-- keyword อาการ (ใช้แนะนำคลินิกเท่านั้น ไม่ใช่การวินิจฉัย)
insert into public.symptom_keywords (clinic_id, keyword_th, keyword_en)
select c.id, v.th, v.en
from (values
  ('ศัลยกรรม', 'ก้อน', 'lump'),
  ('ศัลยกรรม', 'แผลผ่าตัด', 'surgical wound'),
  ('ศัลยกรรม', 'ไส้เลื่อน', 'hernia'),
  ('ศัลยกรรม', 'ไส้ติ่ง', 'appendicitis'),
  ('ศัลยกรรม', 'ถุงน้ำดี', 'gallbladder'),
  ('ศัลยกรรม', 'ฝี', 'abscess'),
  ('ศัลยกรรม', 'บาดแผล', 'laceration'),

  ('อายุรกรรม', 'ไข้', 'fever'),
  ('อายุรกรรม', 'ไอ', 'cough'),
  ('อายุรกรรม', 'ปวดท้อง', 'abdominal pain'),
  ('อายุรกรรม', 'เหนื่อยง่าย', 'fatigue'),
  ('อายุรกรรม', 'เบาหวาน', 'diabetes'),
  ('อายุรกรรม', 'ความดัน', 'blood pressure'),
  ('อายุรกรรม', 'ปวดศีรษะ', 'headache'),
  ('อายุรกรรม', 'ท้องเสีย', 'diarrhea'),
  ('อายุรกรรม', 'ใจสั่น', 'palpitations'),

  ('โรคตา', 'ตามัว', 'blurred vision'),
  ('โรคตา', 'ตาแดง', 'red eye'),
  ('โรคตา', 'ปวดตา', 'eye pain'),
  ('โรคตา', 'น้ำตาไหล', 'watery eyes'),
  ('โรคตา', 'ต้อกระจก', 'cataract'),
  ('โรคตา', 'เห็นภาพซ้อน', 'double vision'),
  ('โรคตา', 'คันตา', 'itchy eyes'),

  ('โรคหูคอจมูก', 'เจ็บคอ', 'sore throat'),
  ('โรคหูคอจมูก', 'คัดจมูก', 'stuffy nose'),
  ('โรคหูคอจมูก', 'น้ำมูก', 'runny nose'),
  ('โรคหูคอจมูก', 'ปวดหู', 'ear pain'),
  ('โรคหูคอจมูก', 'หูอื้อ', 'tinnitus'),
  ('โรคหูคอจมูก', 'เสียงแหบ', 'hoarse voice'),
  ('โรคหูคอจมูก', 'บ้านหมุน', 'vertigo'),
  ('โรคหูคอจมูก', 'ไซนัส', 'sinusitis'),

  ('โรคผิวหนัง', 'ผื่น', 'rash'),
  ('โรคผิวหนัง', 'คัน', 'itching'),
  ('โรคผิวหนัง', 'สิว', 'acne'),
  ('โรคผิวหนัง', 'ผิวแห้ง', 'dry skin'),
  ('โรคผิวหนัง', 'ผมร่วง', 'hair loss'),
  ('โรคผิวหนัง', 'ลมพิษ', 'hives'),
  ('โรคผิวหนัง', 'เชื้อรา', 'fungal infection'),
  ('โรคผิวหนัง', 'ฝ้า', 'melasma')
) as v(cname, th, en)
join public.clinics c on c.name = v.cname;
