-- =====================================================
-- Phase 8 — profiles.role CHECK constraint (typo / 잘못된 role 값 차단)
-- =====================================================
-- 배경: profiles.role 이 TEXT 타입 + DEFAULT 'student' 만 있어서
--   UPDATE profiles SET role='adminn' WHERE id=...  같은 typo 가 통과.
--   RLS 정책은 exact match (role IN ('admin','superadmin')) 라 typo row 는
--   silent 하게 권한 못 받음 — 디버깅 어렵고 RBAC 의 의미가 약해짐.
--
-- ENUM 으로 갈아끼우는 건 RLS 정책 / 함수 / 트리거 / application 코드 전부
-- 영향이라 risk 큼. CHECK constraint 가 95% 효과 + risk 1% 라 그게 정답.
--
-- 적용:
--   Supabase Dashboard > SQL Editor 에서 이 파일 실행.
-- 검증:
--   INSERT INTO profiles (id, email, name, role) VALUES (gen_random_uuid(), 'x@x.com', 'x', 'adminn');
--   → ERROR: new row for relation "profiles" violates check constraint
-- 안전:
--   기존 row 가 invalid value 를 가지면 ADD CONSTRAINT 자체가 실패. 먼저 정리.
-- =====================================================

-- 1) 기존 row 중 invalid role 이 있는지 사전 점검 (실행 후 결과 확인용)
DO $$
DECLARE
  v_count INT;
  v_bad_roles TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(DISTINCT role, ', ')
    INTO v_count, v_bad_roles
    FROM profiles
    WHERE role NOT IN ('student', 'instructor', 'admin', 'superadmin', 'org_admin');
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'profiles 에 invalid role 을 가진 row 가 % 건 있습니다 (값: %). CHECK constraint 추가 전 정리 필요.',
      v_count, v_bad_roles;
  END IF;
END $$;

-- 2) CHECK constraint 추가 (이미 있으면 drop 후 재생성 — idempotent)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'instructor', 'admin', 'superadmin', 'org_admin'));
