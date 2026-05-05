-- =====================================================
-- P0 보안 핫픽스 — 외부 감사로 발견된 즉시 수정 항목
-- =====================================================
-- 1) C1: course_reviews.is_verified, course_answers.is_instructor_answer
--        를 self-write 정책의 WITH CHECK 로 강제 false 화 → 위조 차단
-- 2) C2: SECURITY DEFINER reorder_* RPC 의 EXECUTE 를 PUBLIC 에서 회수,
--        함수 본문에 admin role 체크 추가 → 학생의 홈/메뉴 reorder 차단
-- =====================================================

-- ─── 1. C1: 후기 위조 차단 ─────────────────────────
DROP POLICY IF EXISTS reviews_self_write ON course_reviews;
CREATE POLICY reviews_self_write ON course_reviews
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_verified = false  -- ★ 사용자가 직접 verified 위조 불가
  );

-- ─── 2. C1: 강사 답변 위조 차단 ────────────────────
DROP POLICY IF EXISTS answers_self_write ON course_answers;
CREATE POLICY answers_self_write ON course_answers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_instructor_answer = false  -- ★ 사용자가 직접 instructor 위조 불가
  );

-- 관리자/강사 자동 verified 토글이 필요해지면 별도 SECURITY DEFINER RPC
-- 또는 admin_all 정책 경로를 사용. 현재 코드에는 그런 자동화 없음.

-- ─── 3. C2: SECURITY DEFINER reorder_* 권한 잠금 ────
-- pg_proc 으로 "현재 존재하는" 시그니처에만 작업하도록 동적 처리.
-- 환경별로 시그니처가 달라도 (UUID[]/INT[]) 안전하게 적용됨.

DO $$
DECLARE
  r RECORD;
  v_sig TEXT;
  v_arg_first TEXT;
  v_role_check_block TEXT;
BEGIN
  v_role_check_block := $body$
DECLARE
  v_role TEXT;
  i INT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
$body$;

  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.oid AS oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('reorder_home_sections', 'reorder_nav_menus', 'reorder_menus')
  LOOP
    v_sig := format('%I.%I(%s)', r.schema_name, r.func_name, r.args);

    -- 권한 회수
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated', v_sig);

    RAISE NOTICE 'locked: %', v_sig;
  END LOOP;
END $$;

-- 함수 본문 자체에도 role guard 를 박아둠 (REVOKE 만으로는 superuser
-- 로 직접 호출 시나 향후 권한 부여 실수 시 방어가 어렵기 때문).
-- 현재 시그니처를 가진 함수를 CREATE OR REPLACE 로 갱신 — 시그니처가
-- 환경에 따라 다를 수 있으므로 가능한 모든 조합을 IF EXISTS 로 처리.

-- 3-1) reorder_home_sections (UUID[])
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reorder_home_sections'
      AND pg_get_function_identity_arguments(p.oid) = 'p_ids uuid[]'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION reorder_home_sections(p_ids UUID[])
      RETURNS VOID AS $body$
      DECLARE
        i INT;
        v_role TEXT;
      BEGIN
        SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
        IF v_role IS NULL OR v_role NOT IN ('admin', 'superadmin') THEN
          RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
        END IF;
        FOR i IN 1..array_length(p_ids, 1) LOOP
          UPDATE home_sections SET sort_order = i, updated_at = NOW()
          WHERE id = p_ids[i];
        END LOOP;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    $f$;
  END IF;
END $$;

-- 3-2) reorder_home_sections (INT[]) — legacy 시그니처
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reorder_home_sections'
      AND pg_get_function_identity_arguments(p.oid) = 'p_ids integer[]'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION reorder_home_sections(p_ids INT[])
      RETURNS VOID AS $body$
      DECLARE
        i INT;
        v_role TEXT;
      BEGIN
        SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
        IF v_role IS NULL OR v_role NOT IN ('admin', 'superadmin') THEN
          RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
        END IF;
        FOR i IN 1..array_length(p_ids, 1) LOOP
          UPDATE home_sections SET sort_order = i, updated_at = NOW()
          WHERE id = p_ids[i];
        END LOOP;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    $f$;
  END IF;
END $$;

-- 3-3) reorder_nav_menus (UUID[])
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reorder_nav_menus'
      AND pg_get_function_identity_arguments(p.oid) = 'p_ids uuid[]'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION reorder_nav_menus(p_ids UUID[])
      RETURNS VOID AS $body$
      DECLARE
        i INT;
        v_role TEXT;
      BEGIN
        SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
        IF v_role IS NULL OR v_role NOT IN ('admin', 'superadmin') THEN
          RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
        END IF;
        FOR i IN 1..array_length(p_ids, 1) LOOP
          UPDATE nav_menus SET sort_order = i, updated_at = NOW()
          WHERE id = p_ids[i];
        END LOOP;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    $f$;
  END IF;
END $$;

-- 3-4) reorder_menus (INT[]) — schema.sql 의 menus 테이블 대상
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reorder_menus'
      AND pg_get_function_identity_arguments(p.oid) = 'p_ids integer[]'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION reorder_menus(p_ids INT[])
      RETURNS VOID AS $body$
      DECLARE
        i INT;
        v_role TEXT;
      BEGIN
        SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
        IF v_role IS NULL OR v_role NOT IN ('admin', 'superadmin') THEN
          RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
        END IF;
        FOR i IN 1..array_length(p_ids, 1) LOOP
          UPDATE menus SET sort_order = i, updated_at = NOW()
          WHERE id = p_ids[i];
        END LOOP;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    $f$;
  END IF;
END $$;

-- =====================================================
-- 적용 방법:
--   Supabase Dashboard → SQL Editor 에 전체 붙여넣고 Run.
-- 검증 방법 (별도 SQL):
--   -- 학생 계정 토큰으로 시도 시 'permission denied' 떠야 정상
--   SELECT reorder_home_sections(ARRAY[]::UUID[]);
-- =====================================================
