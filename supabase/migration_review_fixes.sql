-- =====================================================
-- 코드 리뷰 후속 보정 — Critical 이슈 2건
-- =====================================================
-- C1: recalculate_course_duration 트리거에 SECURITY DEFINER 부여
-- C3: site_settings 에 public read 정책 추가
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- C1) 트리거 함수 재정의 — 호출자 권한이 아닌 함수 소유자 권한으로 실행되게 변경
--     courses RLS 가 켜진 상태에서도 lessons 변경 시 total_duration 자동 갱신 보장
CREATE OR REPLACE FUNCTION recalculate_course_duration()
RETURNS TRIGGER AS $$
DECLARE
  v_section_id UUID;
  v_course_id  UUID;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- C3) site_settings 공개 SELECT 정책
--     RootLayout 이 비로그인 컨텍스트(SSR)에서도 primary_color 를 읽을 수 있어야 함
DROP POLICY IF EXISTS "site_settings: public read" ON site_settings;
CREATE POLICY "site_settings: public read" ON site_settings
  FOR SELECT
  USING (true);
