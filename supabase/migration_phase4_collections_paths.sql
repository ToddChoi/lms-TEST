-- =====================================================
-- Phase 4 R2 — 회사 컬렉션 + 직무별 학습맵
-- =====================================================
-- 1) company_course_collections
--    회사가 자기 임직원에게 노출할 강좌 묶음 (컬렉션).
--    페이지 빌더의 'company_collection' 블록이 이 테이블의 row 를 참조.
--
-- 2) learning_paths
--    직무·직급별 학습 시퀀스. 회사 단위로 만들어짐.
--    course_ids 의 순서가 의도된 학습 순서.
-- =====================================================

-- ─── 1. company_course_collections ────────────────────
CREATE TABLE IF NOT EXISTS company_course_collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                                 -- "신입 온보딩", "리더십 필수" 등
  description  TEXT,
  course_ids   UUID[] NOT NULL DEFAULT '{}'::UUID[],
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccc_company_active_sort
  ON company_course_collections(company_id, is_active, sort_order);

ALTER TABLE company_course_collections ENABLE ROW LEVEL SECURITY;

-- 읽기: admin/superadmin + 해당 회사 멤버
DROP POLICY IF EXISTS ccc_read ON company_course_collections;
CREATE POLICY ccc_read ON company_course_collections
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','superadmin'))
    OR EXISTS (SELECT 1 FROM company_members m
               WHERE m.user_id = auth.uid() AND m.company_id = company_course_collections.company_id)
  );

-- 쓰기: admin/superadmin
DROP POLICY IF EXISTS ccc_admin_write ON company_course_collections;
CREATE POLICY ccc_admin_write ON company_course_collections
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ─── 2. learning_paths ────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_paths (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                                -- "신입 디자이너 1년차", "팀장 리더십" 등
  description   TEXT,
  target_role   TEXT,                                         -- 'designer'|'engineer'|... (자유)
  target_level  TEXT,                                         -- 'staff'|'manager'|... (자유)
  course_ids    UUID[] NOT NULL DEFAULT '{}'::UUID[],         -- 순서 = 학습 시퀀스
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_company_active_sort
  ON learning_paths(company_id, is_active, sort_order);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

-- 읽기: admin/superadmin + 해당 회사 멤버
DROP POLICY IF EXISTS lp_read ON learning_paths;
CREATE POLICY lp_read ON learning_paths
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','superadmin'))
    OR EXISTS (SELECT 1 FROM company_members m
               WHERE m.user_id = auth.uid() AND m.company_id = learning_paths.company_id)
  );

-- 쓰기: admin/superadmin
DROP POLICY IF EXISTS lp_admin_write ON learning_paths;
CREATE POLICY lp_admin_write ON learning_paths
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- ─── updated_at 트리거 (재사용) ──────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ccc_set_updated_at ON company_course_collections;
CREATE TRIGGER ccc_set_updated_at
BEFORE UPDATE ON company_course_collections
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS lp_set_updated_at ON learning_paths;
CREATE TRIGGER lp_set_updated_at
BEFORE UPDATE ON learning_paths
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- =====================================================
-- 검증:
--   SELECT 'ccc' AS t, COUNT(*) FROM company_course_collections
--   UNION ALL SELECT 'lp', COUNT(*) FROM learning_paths;
-- =====================================================
