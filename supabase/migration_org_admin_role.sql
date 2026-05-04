-- =====================================================
-- B2B 중간 관리자 — org_admin role 추가
-- =====================================================
-- 학교·기업 등 B2B 고객사의 담당자가 자기 조직 한정으로
-- 직원 강좌 일괄 신청·CSV 내보내기·회사 정보 편집 등을 할 수 있음.
--
-- 권한 범위:
--   - 본사 admin/superadmin: 전체 (변동 없음)
--   - org_admin: 자기 회사 멤버에 한정해서 관리 작업
--   - 기존 student/instructor: 변동 없음
--
-- 실행: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- 1. profiles.role CHECK 제약 확장
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'instructor', 'org_admin', 'student'));

-- 2. 데모 매니저 role 부여
UPDATE profiles SET role = 'org_admin'
WHERE email = 'manager@demo.com';
