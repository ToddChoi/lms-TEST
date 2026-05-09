-- =====================================================
-- P1.2 backfill — lessons.course_id 채우기
-- =====================================================
-- 문제: 기존 lessons 라우트가 INSERT 시 course_id 누락 → 일부 lessons 의
--       course_id 가 NULL. RLS / 진도율 / 잠긴 강의 조회가 깨짐.
-- 해결: section_id 로 join 해서 course_id 채움.
-- 안전: NULL 인 row 만 영향. 이미 채워진 row 는 무시.
-- =====================================================

UPDATE lessons l
SET course_id = s.course_id
FROM sections s
WHERE l.section_id = s.id
  AND l.course_id IS NULL;

-- 검증:
--   SELECT COUNT(*) AS null_count FROM lessons WHERE course_id IS NULL;
--   → 0 이어야 정상.
