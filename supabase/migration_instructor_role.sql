-- =====================================================
-- Phase 5 — instructor 역할 추가
-- =====================================================
-- profiles.role 의 허용값에 'instructor' 를 추가합니다.
-- 강사용 화면(/instructor) 의 미들웨어 가드와 짝을 이룹니다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- 1) 기존 CHECK 제약을 안전하게 교체
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'instructor', 'student'));

-- 2) (선택) 강사 전용 RLS — 본인이 instructor_id 인 강좌만 SELECT/UPDATE 허용
--    admin/superadmin 은 별도 정책으로 풀 권한.
--    courses 테이블 RLS 가 이미 켜져있다면 정책 추가, 아니라면 ENABLE 후 추가.
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_admin_all ON courses;
CREATE POLICY courses_admin_all ON courses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS courses_instructor_own ON courses;
CREATE POLICY courses_instructor_own ON courses
  FOR ALL TO authenticated
  USING (
    instructor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles
                WHERE id = auth.uid()
                  AND role = 'instructor')
  );

DROP POLICY IF EXISTS courses_public_read_active ON courses;
CREATE POLICY courses_public_read_active ON courses
  FOR SELECT
  USING (status = 'active');
