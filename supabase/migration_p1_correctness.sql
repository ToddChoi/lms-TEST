-- =====================================================
-- P1 — 동시성 / 권한 정확성 / 잘못된 RPC
-- =====================================================
-- 1) certificates UNIQUE(user_id, course_id) — 동시 완료 시 인증서 중복 발급 차단
-- 2) increment_notice_views 파라미터 타입 BIGINT 로 수정 (notices.id 가 BIGSERIAL)
-- 3) sections / lessons RLS — instructor 가 본인 강의 외 접근 못 하도록 좁힘 (H5)
-- =====================================================

-- ─── 1. certificates 중복 발급 차단 ────────────────
-- 부분 중복 데이터가 있으면 UNIQUE 추가 실패 → 사전 정리.
-- 같은 (user_id, course_id) 인 경우 가장 오래된 것만 남김.
DELETE FROM certificates c
USING certificates dup
WHERE c.user_id = dup.user_id
  AND c.course_id = dup.course_id
  AND c.issued_at > dup.issued_at;

ALTER TABLE certificates
  DROP CONSTRAINT IF EXISTS certificates_user_course_unique;
ALTER TABLE certificates
  ADD CONSTRAINT certificates_user_course_unique UNIQUE (user_id, course_id);

-- ─── 2. increment_notice_views 시그니처 수정 ───────
-- 옛 정의: UUID 인자. notices.id 는 BIGSERIAL → 모든 호출이 silent fail 하던 상태.
-- 옛 시그니처 제거 + BIGINT 시그니처 신규 정의.
DROP FUNCTION IF EXISTS increment_notice_views(UUID);

CREATE OR REPLACE FUNCTION increment_notice_views(p_notice_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE notices
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_notice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION increment_notice_views(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_notice_views(BIGINT) TO anon, authenticated;

-- ─── 3. instructor RLS scope 정확화 ────────────────
-- 옛 정책: get_my_role() = 'instructor' 면 통과 → 모든 강사가 모든 강의의
--          sections / lessons 접근 가능 (data leak).
-- 새 정책: instructor 는 본인이 instructor_id 인 코스에 한해서만.

DROP POLICY IF EXISTS "sections: admin write" ON sections;
CREATE POLICY "sections: admin write" ON sections
  FOR ALL
  USING (
    get_my_role() IN ('admin', 'superadmin')
    OR (
      get_my_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = sections.course_id AND c.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'superadmin')
    OR (
      get_my_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = sections.course_id AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lessons: public read preview" ON lessons;
CREATE POLICY "lessons: public read preview" ON lessons
  FOR SELECT USING (
    is_preview = TRUE
    OR EXISTS (
      SELECT 1 FROM enrollments
      WHERE user_id = auth.uid()
        AND course_id = lessons.course_id
        AND status = 'active'
    )
    OR get_my_role() IN ('admin', 'superadmin')
    OR (
      get_my_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lessons: admin write" ON lessons;
CREATE POLICY "lessons: admin write" ON lessons
  FOR ALL
  USING (
    get_my_role() IN ('admin', 'superadmin')
    OR (
      get_my_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    get_my_role() IN ('admin', 'superadmin')
    OR (
      get_my_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = lessons.course_id AND c.instructor_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 적용: Supabase Dashboard → SQL Editor → 전체 붙여넣고 Run.
-- 검증:
--   1. 강사1 토큰으로 강사2 의 강의 sections 조회 → 0 rows
--   2. /notice/{id} 새로고침 → notices.view_count 증가 확인
--   3. 한 사용자가 같은 강좌 동시 두 번 완료 시도 시 certificates 한 건만 생성
-- =====================================================
