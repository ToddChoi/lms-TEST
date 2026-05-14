-- =====================================================
-- lessons soft delete — P1 데이터 정합성
-- =====================================================
-- 배경:
--   lessons.section_id 가 ON DELETE CASCADE (sections → lessons → lesson_progress).
--   강사가 lesson 1개 hard delete 하면 학생 N명의 lesson_progress 도 cascade 영구 삭제.
--   진도 / 수료증 / 통계가 거꾸로 손실 → 복구 불가.
--
-- 해결:
--   lessons.deleted_at TIMESTAMPTZ 추가 → DELETE API 가 soft delete (UPDATE).
--   모든 lesson SELECT 에 deleted_at IS NULL 필터 추가 (코드 측).
--   학생 진도 (lesson_progress) 는 보존.
--
-- 한계 (이번 라운드 미처리, 별도 후속):
--   sections / courses 자체 hard delete 시 lessons cascade hard delete →
--   lesson_progress 도 cascade 삭제. sections / courses soft delete 는 별도 작업.
--
-- 적용:
--   Supabase Dashboard > SQL Editor 에서 실행. 멱등 (IF NOT EXISTS).
-- =====================================================

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 활성 lesson (deleted_at IS NULL) 만 조회하는 쿼리가 대부분이므로 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_lessons_active
  ON lessons (course_id, section_id, sort_order)
  WHERE deleted_at IS NULL;

-- 삭제된 lesson 복구 / 감사 위한 별도 인덱스
CREATE INDEX IF NOT EXISTS idx_lessons_deleted
  ON lessons (section_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
