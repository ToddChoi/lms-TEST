-- =====================================================
-- Phase 8 — 학습 노트 (lesson_notes)
-- =====================================================
-- 학습 페이지에서 사용자가 강의별로 메모를 남길 수 있게 합니다.
-- timestamp 컬럼은 영상 시점(초) 옵션 — 추후 시점 점프 기능에 활용.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

CREATE TABLE IF NOT EXISTS lesson_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES lessons(id)  ON DELETE CASCADE,
  course_id    UUID REFERENCES courses(id) ON DELETE CASCADE,
  timestamp    INT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson
  ON lesson_notes(user_id, lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_course
  ON lesson_notes(user_id, course_id, created_at DESC);

ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- 본인의 노트만 자유롭게 SELECT/INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS lesson_notes_self_all ON lesson_notes;
CREATE POLICY lesson_notes_self_all ON lesson_notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 관리자도 읽기 가능 (운영/디버깅)
DROP POLICY IF EXISTS lesson_notes_admin_read ON lesson_notes;
CREATE POLICY lesson_notes_admin_read ON lesson_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'superadmin'))
  );
