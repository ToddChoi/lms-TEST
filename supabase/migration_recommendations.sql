-- ════════════════════════════════════════════════════
-- AI 학습 추천 — Phase 0 DB 마이그레이션
-- ════════════════════════════════════════════════════
-- - pgvector 확장 활성화
-- - profiles 컬럼 확장 (직무·관심사·학습목표)
-- - course_embeddings, user_embeddings, recommendation_cache 테이블
-- - get_similar_courses, get_recommended_courses_for_user RPC
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- ════════════════════════════════════════════════════

-- 1. pgvector 확장
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. profiles 테이블 확장 (콜드 스타트용)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS job_role        TEXT,
  ADD COLUMN IF NOT EXISTS job_level       TEXT,
  ADD COLUMN IF NOT EXISTS interests       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_goals  TEXT;

-- job_level CHECK (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_job_level_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_job_level_check
      CHECK (job_level IS NULL OR job_level IN ('junior','mid','senior','manager'));
  END IF;
END $$;

-- 3. 강좌 임베딩 테이블 (1536차원 — Voyage voyage-3-lite / OpenAI text-embedding-3-small 공통)
CREATE TABLE IF NOT EXISTS course_embeddings (
  course_id   UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  embedding   VECTOR(1536) NOT NULL,
  source_text TEXT,
  model       TEXT NOT NULL DEFAULT 'voyage-3-lite',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- HNSW 인덱스 (코사인 거리)
CREATE INDEX IF NOT EXISTS course_embeddings_hnsw
  ON course_embeddings USING hnsw (embedding vector_cosine_ops);

-- RLS: 누구나 읽기 가능 (강좌 추천은 비로그인도 노출), 관리자만 쓰기
ALTER TABLE course_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_embeddings_public_read ON course_embeddings;
CREATE POLICY course_embeddings_public_read ON course_embeddings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS course_embeddings_admin_write ON course_embeddings;
CREATE POLICY course_embeddings_admin_write ON course_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 4. 사용자 임베딩 테이블
CREATE TABLE IF NOT EXISTS user_embeddings (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  embedding    VECTOR(1536) NOT NULL,
  basis        TEXT NOT NULL DEFAULT 'history',
  course_count INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_embeddings_basis_check'
  ) THEN
    ALTER TABLE user_embeddings
      ADD CONSTRAINT user_embeddings_basis_check
      CHECK (basis IN ('history', 'interests', 'mixed'));
  END IF;
END $$;

ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;

-- 본인만 읽기·쓰기, 관리자는 모두 가능
DROP POLICY IF EXISTS user_embeddings_self_all ON user_embeddings;
CREATE POLICY user_embeddings_self_all ON user_embeddings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_embeddings_admin_all ON user_embeddings;
CREATE POLICY user_embeddings_admin_all ON user_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 5. 추천 캐시 (Phase 9 에서 본격 활용. 인덱스만 미리)
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  context     TEXT NOT NULL,
  course_ids  UUID[] NOT NULL,
  scores      NUMERIC[] NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recommendation_cache_context_check'
  ) THEN
    ALTER TABLE recommendation_cache
      ADD CONSTRAINT recommendation_cache_context_check
      CHECK (context IN ('dashboard','similar','next_step','course_list'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rec_cache_user_ctx
  ON recommendation_cache (user_id, context, expires_at DESC);

ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_cache_self_all ON recommendation_cache;
CREATE POLICY rec_cache_self_all ON recommendation_cache
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. 유사 강좌 조회 함수
-- SECURITY DEFINER: course_embeddings RLS 와 무관하게 항상 동작 (공개 추천이므로 안전)
CREATE OR REPLACE FUNCTION get_similar_courses(
  target_course_id UUID,
  match_count INT DEFAULT 4,
  exclude_self BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  course_id UUID,
  similarity NUMERIC
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT embedding FROM course_embeddings WHERE course_id = target_course_id
  )
  SELECT
    ce.course_id,
    (1 - (ce.embedding <=> (SELECT embedding FROM target)))::NUMERIC AS similarity
  FROM course_embeddings ce
  JOIN courses c ON c.id = ce.course_id
  WHERE c.status = 'active'
    AND (NOT exclude_self OR ce.course_id <> target_course_id)
    AND EXISTS (SELECT 1 FROM target)
  ORDER BY ce.embedding <=> (SELECT embedding FROM target)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION get_similar_courses(UUID, INT, BOOLEAN) TO anon, authenticated;

-- 7. 사용자 맞춤 추천 함수
CREATE OR REPLACE FUNCTION get_recommended_courses_for_user(
  target_user_id UUID,
  match_count INT DEFAULT 6,
  exclude_enrolled BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  course_id UUID,
  similarity NUMERIC
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (
    SELECT embedding FROM user_embeddings WHERE user_id = target_user_id
  ),
  enrolled AS (
    SELECT course_id FROM enrollments WHERE user_id = target_user_id
  )
  SELECT
    ce.course_id,
    (1 - (ce.embedding <=> (SELECT embedding FROM target)))::NUMERIC AS similarity
  FROM course_embeddings ce
  JOIN courses c ON c.id = ce.course_id
  WHERE c.status = 'active'
    AND EXISTS (SELECT 1 FROM target)
    AND (NOT exclude_enrolled OR ce.course_id NOT IN (SELECT course_id FROM enrolled))
  ORDER BY ce.embedding <=> (SELECT embedding FROM target)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION get_recommended_courses_for_user(UUID, INT, BOOLEAN) TO authenticated;
