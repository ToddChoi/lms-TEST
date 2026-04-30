-- =====================================================
-- 수강평 + Q&A 시스템
-- =====================================================
-- 강좌 상세 페이지에서 수강생이 평점·후기를 남기고 질문/답변을 주고받음.
-- 신뢰도 = 실제 수강생만 작성 가능 (active/completed enrollments).
-- =====================================================

-- ─── 1. 수강평 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating        INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content       TEXT NOT NULL,
  is_verified   BOOLEAN NOT NULL DEFAULT false,   -- 실제 수강생 인증
  helpful_count INT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, user_id)                       -- 한 사용자 = 한 후기
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_created
  ON course_reviews(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user
  ON course_reviews(user_id);

ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
DROP POLICY IF EXISTS reviews_public_read ON course_reviews;
CREATE POLICY reviews_public_read ON course_reviews
  FOR SELECT USING (true);

-- 본인 후기만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS reviews_self_write ON course_reviews;
CREATE POLICY reviews_self_write ON course_reviews
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 관리자는 모든 후기 관리 가능
DROP POLICY IF EXISTS reviews_admin_all ON course_reviews;
CREATE POLICY reviews_admin_all ON course_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- 후기 변경 시 courses.rating_avg / rating_count 자동 갱신
CREATE OR REPLACE FUNCTION recalculate_course_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
BEGIN
  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  IF v_course_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE courses
  SET
    rating_avg   = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2)
                             FROM course_reviews
                             WHERE course_id = v_course_id), 0),
    rating_count = (SELECT COUNT(*) FROM course_reviews WHERE course_id = v_course_id)
  WHERE id = v_course_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS reviews_recalculate_rating ON course_reviews;
CREATE TRIGGER reviews_recalculate_rating
AFTER INSERT OR UPDATE OR DELETE ON course_reviews
FOR EACH ROW EXECUTE FUNCTION recalculate_course_rating();

-- ─── 2. Q&A 질문 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS course_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_questions_course_created
  ON course_questions(course_id, created_at DESC);

ALTER TABLE course_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_public_read ON course_questions;
CREATE POLICY questions_public_read ON course_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS questions_self_write ON course_questions;
CREATE POLICY questions_self_write ON course_questions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS questions_admin_all ON course_questions;
CREATE POLICY questions_admin_all ON course_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ─── 3. Q&A 답변 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS course_answers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id          UUID NOT NULL REFERENCES course_questions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content              TEXT NOT NULL,
  is_instructor_answer BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_answers_question
  ON course_answers(question_id, created_at);

ALTER TABLE course_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS answers_public_read ON course_answers;
CREATE POLICY answers_public_read ON course_answers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS answers_self_write ON course_answers;
CREATE POLICY answers_self_write ON course_answers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS answers_admin_all ON course_answers;
CREATE POLICY answers_admin_all ON course_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );
