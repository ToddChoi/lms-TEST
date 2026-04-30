-- =====================================================
-- UI/UX 고도화 — courses 메타데이터 컬럼 추가
-- =====================================================
-- CourseCardV2 / 강좌 상세 / 필터 시스템에서 사용할 컬럼들.
-- 모두 nullable / DEFAULT 값 있으므로 기존 데이터에 영향 없음.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS rating_avg     NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count   INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrolled_count INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level          TEXT,
  ADD COLUMN IF NOT EXISTS preview_url    TEXT,
  ADD COLUMN IF NOT EXISTS price_original NUMERIC(10,0),
  ADD COLUMN IF NOT EXISTS badge          TEXT NOT NULL DEFAULT 'none';

-- 값 제약 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_level_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_level_check
      CHECK (level IS NULL OR level IN ('beginner','intermediate','advanced','all'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_badge_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_badge_check
      CHECK (badge IN ('none','new','best','hot','event'));
  END IF;
END $$;

-- 정렬·필터 인덱스
CREATE INDEX IF NOT EXISTS idx_courses_status_enrolled
  ON courses(status, enrolled_count DESC);
CREATE INDEX IF NOT EXISTS idx_courses_status_rating
  ON courses(status, rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_courses_status_created
  ON courses(status, created_at DESC);

-- enrolled_count 자동 갱신 트리거 — enrollments 변경 시 동기화
CREATE OR REPLACE FUNCTION recalculate_course_enrolled_count()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
BEGIN
  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  IF v_course_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE courses
  SET enrolled_count = (
    SELECT COUNT(*) FROM enrollments
    WHERE course_id = v_course_id AND status IN ('active','completed')
  )
  WHERE id = v_course_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enrollments_recalculate_count ON enrollments;
CREATE TRIGGER enrollments_recalculate_count
AFTER INSERT OR UPDATE OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION recalculate_course_enrolled_count();

-- 한 번 정합 보정 (기존 데이터)
UPDATE courses c
SET enrolled_count = (
  SELECT COUNT(*) FROM enrollments e
  WHERE e.course_id = c.id AND e.status IN ('active','completed')
);
