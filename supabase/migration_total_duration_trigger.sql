-- =====================================================
-- Phase 6 — courses.total_duration 자동 갱신 트리거
-- =====================================================
-- lessons 테이블에 INSERT / UPDATE / DELETE 가 발생하면
-- 해당 강좌(courses)의 total_duration 을 자동으로 재계산합니다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- 1) 트리거 함수
CREATE OR REPLACE FUNCTION recalculate_course_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_section_id UUID;
  v_course_id  UUID;
BEGIN
  -- INSERT/UPDATE 면 NEW, DELETE 면 OLD
  v_section_id := COALESCE(NEW.section_id, OLD.section_id);

  SELECT course_id INTO v_course_id FROM sections WHERE id = v_section_id;
  IF v_course_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE courses
  SET total_duration = (
    SELECT COALESCE(SUM(l.duration), 0)
    FROM lessons l
    JOIN sections s ON s.id = l.section_id
    WHERE s.course_id = v_course_id
  )
  WHERE id = v_course_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2) 트리거
DROP TRIGGER IF EXISTS lessons_recalculate_duration ON lessons;
CREATE TRIGGER lessons_recalculate_duration
AFTER INSERT OR UPDATE OR DELETE ON lessons
FOR EACH ROW EXECUTE FUNCTION recalculate_course_duration();

-- 3) 기존 데이터 강제 재계산 (한 번만 실행되어도 OK)
UPDATE courses c
SET total_duration = (
  SELECT COALESCE(SUM(l.duration), 0)
  FROM lessons l
  JOIN sections s ON s.id = l.section_id
  WHERE s.course_id = c.id
);
