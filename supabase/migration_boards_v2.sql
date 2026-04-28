-- =====================================================
-- Phase 3 — Boards v2 (notices / contacts 보강)
-- =====================================================
-- 기존 테이블 (notices, faqs, contacts) 은 유지하면서
-- 명세에 맞게 누락된 컬럼만 추가합니다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- ─── notices: 조회수 / 작성자 / 수정일 추가 ─────────
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS author_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 조회수 증가용 RPC (단일 SQL 호출로 안전하게 +1)
CREATE OR REPLACE FUNCTION increment_notice_views(p_notice_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notices SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_notice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 익명 사용자도 호출할 수 있게
GRANT EXECUTE ON FUNCTION increment_notice_views(UUID) TO anon, authenticated;

-- ─── contacts: 문의 유형 / 전화 / 회사명 추가 ──────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS type    TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS phone   TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT;

-- 유형 체크 제약 (general / b2b / course / technical)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_type_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_type_check
      CHECK (type IN ('general', 'b2b', 'course', 'technical'));
  END IF;
END $$;

-- 인덱스 (관리자 목록 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_contacts_status_created ON contacts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_visible_pinned ON notices(is_active, is_pinned DESC, created_at DESC);
