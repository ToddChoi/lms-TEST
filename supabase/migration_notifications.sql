-- =====================================================
-- Phase 4 — 알림 시스템 (이메일 발송 로그 + 사용자 설정)
-- =====================================================
-- 실행 위치: Supabase Dashboard → SQL Editor → Run
-- =====================================================

-- ─── 1. 발송 로그 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,            -- 'email' | 'kakao_alimtalk'
  template    TEXT NOT NULL,            -- 'welcome' | 'enrollment' | ...
  recipient   TEXT NOT NULL,            -- email address or phone number
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  error       TEXT,
  payload     JSONB,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_created
  ON notification_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_template_status
  ON notification_logs(template, status);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 모든 로그 조회 가능 (사용자는 본인 로그만)
DROP POLICY IF EXISTS notification_logs_admin_all ON notification_logs;
CREATE POLICY notification_logs_admin_all ON notification_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS notification_logs_self_read ON notification_logs;
CREATE POLICY notification_logs_self_read ON notification_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 2. 사용자 알림 설정 ──────────────────────────
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enrollment BOOLEAN NOT NULL DEFAULT true,
  email_completion BOOLEAN NOT NULL DEFAULT true,
  email_certificate BOOLEAN NOT NULL DEFAULT true,
  email_marketing  BOOLEAN NOT NULL DEFAULT false,  -- 옵트인
  kakao_enrollment BOOLEAN NOT NULL DEFAULT false,
  kakao_completion BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unp_self_all ON user_notification_preferences;
CREATE POLICY unp_self_all ON user_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS unp_admin_read ON user_notification_preferences;
CREATE POLICY unp_admin_read ON user_notification_preferences
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'superadmin'))
  );
