-- =====================================================
-- 오프라인 교육 신청·운영 — Phase 1 (DB 기반 구조)
-- 명세: docs/FEATURE_OFFLINE_EDUCATION.md
-- =====================================================
-- 적용:
--   Supabase Dashboard > SQL Editor 에서 통째로 실행.
-- 멱등 안전:
--   모든 CREATE 가 IF NOT EXISTS / 사전 존재 검사 사용.
--   재실행해도 OK.
--
-- 포함:
--   1.  offline_programs               (강좌 마스터)
--   2.  offline_sessions               (회차)
--   3.  offline_session_days           (회차 일자 + QR 토큰)
--   4.  offline_enrollments            (신청)
--   5.  offline_attendees              (단체 참석자)
--   6.  offline_waitlist               (대기열)
--   7.  offline_attendance             (출석 기록)
--   8.  offline_certificates           (오프라인 수료증)
--   9.  offline_notifications          (알림 큐/로그)
--   10. site_settings 글로벌 9 키 INSERT
--   11. RLS 정책 9 테이블 (P0 — 명세서 §3.11)
--   12. 동시성 / 멱등성 / partial index / 알림 retry (P0 — 명세서 §3.12)
-- =====================================================

-- ────────────────────────────────────────
-- 1. offline_programs
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_url   TEXT,

  program_type    TEXT NOT NULL CHECK (program_type IN (
                    'workshop', 'regular_course', 'corporate'
                  )),

  instructor_name TEXT,
  instructor_bio  TEXT,

  what_you_learn   TEXT[] DEFAULT '{}',
  requirements     TEXT[] DEFAULT '{}',
  target_audience  TEXT,

  completion_attendance_rate INT NOT NULL DEFAULT 80
                             CHECK (completion_attendance_rate BETWEEN 0 AND 100),

  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'closed')),
  is_featured     BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_programs_status   ON offline_programs(status);
CREATE INDEX IF NOT EXISTS idx_offline_programs_category ON offline_programs(category_id);

-- ────────────────────────────────────────
-- 2. offline_sessions
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES offline_programs(id) ON DELETE CASCADE,

  title           TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,

  capacity        INT NOT NULL CHECK (capacity > 0),
  price           INT NOT NULL DEFAULT 0 CHECK (price >= 0),

  location_name    TEXT,
  location_address TEXT,
  location_url     TEXT,

  payment_deadline_days          INT CHECK (payment_deadline_days IS NULL OR payment_deadline_days > 0),
  payment_deadline_before_start  INT CHECK (payment_deadline_before_start IS NULL OR payment_deadline_before_start > 0),

  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'cancelled', 'completed')),

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_offline_sessions_program     ON offline_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_start_date  ON offline_sessions(start_date);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_status      ON offline_sessions(status);

-- ────────────────────────────────────────
-- 3. offline_session_days (QR 토큰)
-- ────────────────────────────────────────
-- ★ P0 보안: qr_token 은 lib/offline/qr.ts 에서
--    crypto.randomBytes(32).toString('base64url') 로 생성 (256-bit entropy).
--    sequential / timestamp 기반 토큰 절대 X.
CREATE TABLE IF NOT EXISTS offline_session_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,

  day_number      INT NOT NULL CHECK (day_number > 0),
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  topic           TEXT,

  qr_token        TEXT UNIQUE,
  qr_active_from  TIMESTAMPTZ,
  qr_active_until TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now(),

  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_offline_session_days_session ON offline_session_days(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_session_days_qr      ON offline_session_days(qr_token);

-- ────────────────────────────────────────
-- 4. offline_enrollments
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE RESTRICT,

  applicant_user_id UUID NOT NULL REFERENCES profiles(id),
  applicant_type    TEXT NOT NULL CHECK (applicant_type IN ('individual', 'corporate')),

  company_id              UUID REFERENCES companies(id),
  company_contact_name    TEXT,
  company_contact_phone   TEXT,
  company_contact_email   TEXT,

  attendee_count   INT NOT NULL DEFAULT 1 CHECK (attendee_count >= 1),

  status           TEXT NOT NULL DEFAULT 'pending_payment'
                     CHECK (status IN (
                       'pending_payment', 'confirmed',
                       'expired', 'cancelled', 'refunded'
                     )),

  payment_method   TEXT CHECK (payment_method IN ('card', 'invoice')),
  total_amount     INT NOT NULL CHECK (total_amount >= 0),
  payment_due_at   TIMESTAMPTZ NOT NULL,
  paid_at          TIMESTAMPTZ,

  cancelled_at     TIMESTAMPTZ,
  refunded_at      TIMESTAMPTZ,
  refund_amount    INT CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_rate      INT CHECK (refund_rate IS NULL OR refund_rate IN (0, 50, 100)),

  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,

  invoice_issued_at         TIMESTAMPTZ,
  invoice_number            TEXT,
  invoice_paid_confirmed_by UUID REFERENCES profiles(id),

  notes            TEXT,

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_enrollments_session     ON offline_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_applicant   ON offline_enrollments(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_company     ON offline_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_status      ON offline_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_payment_due ON offline_enrollments(payment_due_at);
-- 복합: 회차의 confirmed 카운팅 자주 → covering
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_session_status
  ON offline_enrollments(session_id, status);

-- ────────────────────────────────────────
-- 5. offline_attendees
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  department      TEXT,
  position        TEXT,

  user_id         UUID REFERENCES profiles(id),
  cancelled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_attendees_enrollment ON offline_attendees(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_offline_attendees_user       ON offline_attendees(user_id);

-- ────────────────────────────────────────
-- 6. offline_waitlist
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_waitlist (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES profiles(id),

  attendee_count         INT NOT NULL DEFAULT 1 CHECK (attendee_count >= 1),
  position               INT NOT NULL CHECK (position > 0),

  notified_at            TIMESTAMPTZ,
  reservation_deadline   TIMESTAMPTZ,

  status                 TEXT NOT NULL DEFAULT 'waiting'
                           CHECK (status IN ('waiting', 'notified', 'converted', 'expired')),

  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),

  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_waitlist_session ON offline_waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_waitlist_status  ON offline_waitlist(status);

-- ────────────────────────────────────────
-- 7. offline_attendance
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_day_id      UUID NOT NULL REFERENCES offline_session_days(id) ON DELETE CASCADE,
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id),

  status              TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),

  checked_at          TIMESTAMPTZ,
  checked_by          TEXT NOT NULL CHECK (checked_by IN ('self_qr', 'admin')),
  checked_by_admin_id UUID REFERENCES profiles(id),

  notes               TEXT,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  -- user_id 또는 attendee_id 중 하나는 반드시 존재
  CHECK (user_id IS NOT NULL OR attendee_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_offline_attendance_day        ON offline_attendance(session_day_id);
CREATE INDEX IF NOT EXISTS idx_offline_attendance_enrollment ON offline_attendance(enrollment_id);

-- ────────────────────────────────────────
-- 8. offline_certificates
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          UUID NOT NULL REFERENCES offline_programs(id),
  session_id          UUID NOT NULL REFERENCES offline_sessions(id),
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id),

  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id),

  certificate_number  TEXT NOT NULL UNIQUE,
  attendance_rate     INT NOT NULL CHECK (attendance_rate BETWEEN 0 AND 100),

  issued_at           TIMESTAMPTZ DEFAULT now(),
  pdf_url             TEXT,

  CHECK (user_id IS NOT NULL OR attendee_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_offline_certificates_user    ON offline_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_certificates_session ON offline_certificates(session_id);

-- ────────────────────────────────────────
-- 9. offline_notifications
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  enrollment_id   UUID REFERENCES offline_enrollments(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id),

  type            TEXT NOT NULL CHECK (type IN (
                    'application_received', 'payment_instruction',
                    'payment_due_3days', 'payment_due_1day', 'payment_expired',
                    'payment_confirmed',
                    'pre_event_2weeks', 'reminder_1day',
                    'attendance_checked_in', 'certificate_issued',
                    'survey_request',
                    'waitlist_available', 'cancellation_confirmed', 'session_cancelled'
                  )),

  channels        TEXT[] NOT NULL DEFAULT '{email,sms,in_app}',

  email_sent_at   TIMESTAMPTZ,
  sms_sent_at     TIMESTAMPTZ,
  in_app_read_at  TIMESTAMPTZ,

  scheduled_at    TIMESTAMPTZ,

  subject         TEXT,
  body            TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message   TEXT,

  -- P0 보강: retry 추적 (cron 이 max 3회까지 재시도 후 abandon)
  retry_count     INT NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_notifications_scheduled
  ON offline_notifications(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_offline_notifications_user
  ON offline_notifications(user_id);

-- ────────────────────────────────────────
-- 10. site_settings — 글로벌 설정값
-- ────────────────────────────────────────
INSERT INTO site_settings (key, value, label, group_name) VALUES
  ('offline_payment_deadline_days',          '7',  '결제 기한 (신청 후 N일)',           'offline'),
  ('offline_payment_deadline_before_start',  '3',  '결제 기한 (강좌 시작 N일 전)',       'offline'),
  ('offline_refund_full_days',               '7',  '100% 환불 가능 (강좌 시작 N일 전)',  'offline'),
  ('offline_refund_half_days',               '3',  '50% 환불 가능 (강좌 시작 N일 전)',   'offline'),
  ('offline_waitlist_grace_hours',           '24', '대기열 결제 기한 (알림 후 N시간)',    'offline'),
  ('offline_qr_window_minutes',              '30', 'QR 활성화 시간 (시작 전/후 N분)',    'offline'),
  ('offline_pre_event_notice_days',          '14', '사전 안내 발송 (강좌 N일 전)',       'offline'),
  ('offline_bank_account',                   '',   '입금 계좌 (세금계산서 결제용)',      'offline'),
  ('offline_invoice_company_info',           '',   '세금계산서 발행 정보(JSON)',         'offline')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────
-- 11. RLS 정책 (P0 보강 — 명세서 §3.11)
-- ────────────────────────────────────────
ALTER TABLE offline_programs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_session_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_attendees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_waitlist       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_certificates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_notifications  ENABLE ROW LEVEL SECURITY;

-- helper: 현재 user 가 admin/instructor 인지
-- (기존 코드 패턴 그대로 — 별도 SECURITY DEFINER 함수 없음)

-- ── offline_programs ──
DROP POLICY IF EXISTS "offline_programs: public read active" ON offline_programs;
CREATE POLICY "offline_programs: public read active"
  ON offline_programs FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "offline_programs: admin all" ON offline_programs;
CREATE POLICY "offline_programs: admin all"
  ON offline_programs FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_sessions ──
DROP POLICY IF EXISTS "offline_sessions: public read" ON offline_sessions;
CREATE POLICY "offline_sessions: public read"
  ON offline_sessions FOR SELECT USING (status IN ('open', 'closed', 'completed'));
DROP POLICY IF EXISTS "offline_sessions: admin all" ON offline_sessions;
CREATE POLICY "offline_sessions: admin all"
  ON offline_sessions FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_session_days (QR 토큰 노출 차단 — confirmed 신청자 또는 admin) ──
DROP POLICY IF EXISTS "offline_session_days: enrolled read" ON offline_session_days;
CREATE POLICY "offline_session_days: enrolled read"
  ON offline_session_days FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.session_id = offline_session_days.session_id
      AND e.applicant_user_id = auth.uid()
      AND e.status = 'confirmed'));
DROP POLICY IF EXISTS "offline_session_days: admin all" ON offline_session_days;
CREATE POLICY "offline_session_days: admin all"
  ON offline_session_days FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_enrollments ──
DROP POLICY IF EXISTS "offline_enrollments: self read" ON offline_enrollments;
CREATE POLICY "offline_enrollments: self read"
  ON offline_enrollments FOR SELECT USING (applicant_user_id = auth.uid());
DROP POLICY IF EXISTS "offline_enrollments: admin all" ON offline_enrollments;
CREATE POLICY "offline_enrollments: admin all"
  ON offline_enrollments FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_attendees ──
DROP POLICY IF EXISTS "offline_attendees: enrollment owner read" ON offline_attendees;
CREATE POLICY "offline_attendees: enrollment owner read"
  ON offline_attendees FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.id = offline_attendees.enrollment_id
      AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS "offline_attendees: self linked read" ON offline_attendees;
CREATE POLICY "offline_attendees: self linked read"
  ON offline_attendees FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "offline_attendees: admin all" ON offline_attendees;
CREATE POLICY "offline_attendees: admin all"
  ON offline_attendees FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_waitlist ──
DROP POLICY IF EXISTS "offline_waitlist: self read" ON offline_waitlist;
CREATE POLICY "offline_waitlist: self read"
  ON offline_waitlist FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "offline_waitlist: admin all" ON offline_waitlist;
CREATE POLICY "offline_waitlist: admin all"
  ON offline_waitlist FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_attendance ──
DROP POLICY IF EXISTS "offline_attendance: self read" ON offline_attendance;
CREATE POLICY "offline_attendance: self read"
  ON offline_attendance FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_attendance.enrollment_id
        AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS "offline_attendance: admin all" ON offline_attendance;
CREATE POLICY "offline_attendance: admin all"
  ON offline_attendance FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_certificates ──
DROP POLICY IF EXISTS "offline_certificates: self read" ON offline_certificates;
CREATE POLICY "offline_certificates: self read"
  ON offline_certificates FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_certificates.enrollment_id
        AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS "offline_certificates: admin all" ON offline_certificates;
CREATE POLICY "offline_certificates: admin all"
  ON offline_certificates FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── offline_notifications ──
DROP POLICY IF EXISTS "offline_notifications: self read" ON offline_notifications;
CREATE POLICY "offline_notifications: self read"
  ON offline_notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "offline_notifications: admin all" ON offline_notifications;
CREATE POLICY "offline_notifications: admin all"
  ON offline_notifications FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ────────────────────────────────────────
-- 12. 동시성 / 멱등성 / partial index (P0 — 명세서 §3.12)
-- ────────────────────────────────────────
-- (a) Stripe Webhook 멱등성: stripe_session_id 가 NOT NULL 일 때 중복 INSERT 차단
CREATE UNIQUE INDEX IF NOT EXISTS offline_enrollments_stripe_session_unique
  ON offline_enrollments (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- (b) 동일 사용자의 동일 회차 active enrollment 중복 방지 (취소/환불 후 재신청은 OK)
CREATE UNIQUE INDEX IF NOT EXISTS offline_enrollments_active_unique
  ON offline_enrollments (session_id, applicant_user_id)
  WHERE status IN ('pending_payment', 'confirmed');

-- (c) 출석 중복 방지 — UNIQUE 가 NULL 처리에 약하므로 partial index 로 보강
CREATE UNIQUE INDEX IF NOT EXISTS offline_attendance_user_unique
  ON offline_attendance (session_day_id, enrollment_id, user_id)
  WHERE user_id IS NOT NULL AND attendee_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS offline_attendance_attendee_unique
  ON offline_attendance (session_day_id, enrollment_id, attendee_id)
  WHERE attendee_id IS NOT NULL;
