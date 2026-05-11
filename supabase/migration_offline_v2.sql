-- =====================================================
-- 오프라인 교육 — 데이터 모델 v2 (Phase 1 DB 기반 구조)
-- 명세: docs/DATA_MODEL_OFFLINE_V2.md
-- =====================================================
-- v1 (migration_offline.sql) 폐기 후 본 파일로 교체.
-- 사용자가 v1 미적용 (Supabase 에 v1 SQL 실행 X) 상태에서 시작.
--
-- 적용:
--   Supabase Dashboard > SQL Editor 에서 통째로 실행. 실행 순서 보존됨.
-- 멱등 안전:
--   모든 CREATE 가 IF NOT EXISTS / DROP IF EXISTS 후 재생성. 재실행해도 OK.
--
-- 포함:
--   1.  글로벌 site_settings 키 INSERT
--   2.  헬퍼 함수 (is_admin, set_updated_at)
--   3.  도메인 테이블 11종
--         offline_programs / offline_sessions / offline_session_days
--         offline_enrollments / offline_attendees / offline_waitlist
--         offline_attendance / offline_certificates / offline_notifications
--         offline_refunds (Q6 ②)  / offline_audit_log
--   4.  인덱스 (모두 deleted_at 또는 status 부분 인덱스)
--   5.  비즈니스 함수
--         offline_session_available_seats / offline_session_seat_breakdown
--         offline_create_enrollment (FOR UPDATE 정원 검증)
--   6.  트리거
--         updated_at 자동 갱신 / 상태 전이 검증 / QR 활성시간 자동 계산
--         단체 인원 sync / 감사 로그 자동 기록
--   7.  RLS — 모든 테이블 enable + policies
--
-- v2 명세 + 추가 보강 (검토 결과):
--   A. offline_create_enrollment 에 SECURITY DEFINER + search_path 고정
--   B. is_admin() 의 role 다중 (admin, superadmin) — 기존 ingrow 패턴 일치
--   C. QR 트리거 timezone 캐스팅 명확화
--   D. 잔여석 함수 GROUP BY 명확화
--   E. attendee_count CHECK >= 0 으로 완화 (모두 cancel 시 트리거 실패 방지)
--   F. 마이그레이션 순서 (site_settings → 헬퍼 → 테이블 → 인덱스 → 함수 → 트리거 → RLS)
--
-- Q1-Q7 결정 (사용자 합리적 default 위임):
--   Q1 가격 표기  : 회차마다 vat_included 컬럼 (혼재 허용)
--   Q2 단체 할인  : 단순 곱셈 (unit_price × attendee_count)
--   Q3 결제 기한  : 신청일 + N일의 23:59 KST (실무 표준)
--   Q4 timezone  : 한국 고정 (Asia/Seoul)
--   Q5 출석률    : 시간 가중 평균 (Phase 5 수료증 발급 함수에서 적용 — 본 파일에선 schema 만 준비)
--   Q6 부분 환불 : offline_refunds 별도 테이블
--   Q7 익명화    : 별도 단계 (현재 ON DELETE RESTRICT 만)
-- =====================================================


-- ────────────────────────────────────────
-- 1. site_settings 글로벌 키 INSERT (먼저 — 트리거에서 참조)
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
-- 2. 헬퍼 함수
-- ────────────────────────────────────────

-- 보강 B: is_admin() 의 role 을 ingrow 기존 패턴과 일치 (admin + superadmin)
CREATE OR REPLACE FUNCTION is_offline_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION is_offline_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')
  );
$$;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────
-- 3-1. offline_programs
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_programs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_url    TEXT,

  program_type     TEXT NOT NULL CHECK (program_type IN (
                     'workshop', 'regular_course', 'corporate'
                   )),

  instructor_name  TEXT,
  instructor_bio   TEXT,

  what_you_learn   TEXT[] NOT NULL DEFAULT '{}',
  requirements     TEXT[] NOT NULL DEFAULT '{}',
  target_audience  TEXT,

  completion_attendance_rate INT NOT NULL DEFAULT 80
                     CHECK (completion_attendance_rate BETWEEN 0 AND 100),

  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'active', 'closed')),
  is_featured      BOOLEAN NOT NULL DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_programs_active
  ON offline_programs(status, is_featured, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_category
  ON offline_programs(category_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_slug_active
  ON offline_programs(slug)
  WHERE deleted_at IS NULL;


-- ────────────────────────────────────────
-- 3-2. offline_sessions
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       UUID NOT NULL REFERENCES offline_programs(id) ON DELETE RESTRICT,

  title            TEXT,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,

  capacity         INT NOT NULL CHECK (capacity > 0),

  -- Q1: vat_included 컬럼으로 회차마다 선택
  price            INT NOT NULL DEFAULT 0 CHECK (price >= 0),
  vat_included     BOOLEAN NOT NULL DEFAULT true,

  location_name    TEXT,
  location_address TEXT,
  location_url     TEXT,

  payment_deadline_days         INT CHECK (payment_deadline_days IS NULL OR payment_deadline_days > 0),
  payment_deadline_before_start INT CHECK (payment_deadline_before_start IS NULL OR payment_deadline_before_start >= 0),

  -- 환불 정책 스냅샷 (회차 단위, 신청 시 enrollment 로 또 한 번 스냅샷)
  refund_policy    JSONB NOT NULL DEFAULT '{
    "full_refund_days_before": 7,
    "half_refund_days_before": 3
  }'::jsonb,

  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'closed', 'cancelled', 'completed')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT sessions_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_sessions_program
  ON offline_sessions(program_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_open
  ON offline_sessions(start_date, status)
  WHERE deleted_at IS NULL AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_sessions_upcoming
  ON offline_sessions(start_date)
  WHERE deleted_at IS NULL AND status IN ('open', 'closed');


-- ────────────────────────────────────────
-- 3-3. offline_session_days
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_session_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,

  day_number       INT NOT NULL CHECK (day_number > 0),
  date             DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  topic            TEXT,

  -- ★ P0 보안: lib/offline/qr.ts 가 crypto.randomBytes(32).toString('base64url') 로 생성
  --   length(qr_token) >= 32 강제 — sequential / timestamp 기반 토큰 차단
  qr_token         TEXT NOT NULL UNIQUE
                     CHECK (length(qr_token) >= 32),

  qr_active_from   TIMESTAMPTZ NOT NULL,
  qr_active_until  TIMESTAMPTZ NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT session_days_time_order CHECK (end_time > start_time),
  CONSTRAINT session_days_qr_window  CHECK (qr_active_until > qr_active_from),
  UNIQUE (session_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_session_days_session ON offline_session_days(session_id);
CREATE INDEX IF NOT EXISTS idx_session_days_date    ON offline_session_days(date);


-- ────────────────────────────────────────
-- 3-4. offline_enrollments (가격 / 환불 정책 신청 시점 스냅샷)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE RESTRICT,

  applicant_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  applicant_type    TEXT NOT NULL CHECK (applicant_type IN ('individual', 'corporate')),

  company_id              UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_contact_name    TEXT,
  company_contact_phone   TEXT,
  company_contact_email   TEXT,

  -- 보강 E: 모두 cancel 시 sync 트리거가 0 으로 UPDATE — CHECK >= 0 로 완화.
  -- 운영자가 수동 cancelled 처리 책임 (또는 별도 트리거에서 후속 처리).
  attendee_count   INT NOT NULL DEFAULT 1 CHECK (attendee_count >= 0),

  status           TEXT NOT NULL DEFAULT 'pending_payment'
                     CHECK (status IN (
                       'pending_payment', 'confirmed',
                       'expired', 'cancelled', 'refunded'
                     )),

  payment_method   TEXT CHECK (payment_method IN ('card', 'invoice')),

  -- 신청 시점 스냅샷 — Q1/Q2 적용 (단순 곱셈, vat_included 회차값 복사)
  unit_price       INT NOT NULL CHECK (unit_price >= 0),
  total_amount     INT NOT NULL CHECK (total_amount >= 0),
  vat_included     BOOLEAN NOT NULL,

  -- Q3: KST 23:59:59 — offline_create_enrollment 함수에서 계산
  payment_due_at   TIMESTAMPTZ NOT NULL,
  paid_at          TIMESTAMPTZ,

  -- 환불 정책 스냅샷
  refund_policy_snapshot JSONB NOT NULL,

  cancelled_at     TIMESTAMPTZ,
  cancelled_by     TEXT CHECK (cancelled_by IN ('user', 'admin', 'system_expired')),
  -- Q6: 누적 환불액 (개별 환불 이력은 offline_refunds 테이블)
  refunded_at      TIMESTAMPTZ,
  refund_amount    INT CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_rate      INT CHECK (refund_rate IS NULL OR refund_rate BETWEEN 0 AND 100),

  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,

  invoice_issued_at           TIMESTAMPTZ,
  invoice_number              TEXT,
  invoice_paid_confirmed_at   TIMESTAMPTZ,
  invoice_paid_confirmed_by   UUID REFERENCES profiles(id),

  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,

  CONSTRAINT enrollments_corporate_company CHECK (
    applicant_type = 'individual' OR company_id IS NOT NULL
  ),
  CONSTRAINT enrollments_refund_consistency CHECK (
    (refunded_at IS NULL AND refund_amount IS NULL AND refund_rate IS NULL)
    OR
    (refunded_at IS NOT NULL AND refund_amount IS NOT NULL AND refund_rate IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_enrollments_session
  ON offline_enrollments(session_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_applicant
  ON offline_enrollments(applicant_user_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_company
  ON offline_enrollments(company_id)
  WHERE deleted_at IS NULL AND company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_pending_payment_due
  ON offline_enrollments(payment_due_at)
  WHERE deleted_at IS NULL AND status = 'pending_payment';
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_stripe_session
  ON offline_enrollments(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;


-- ────────────────────────────────────────
-- 3-5. offline_attendees
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id    UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  department       TEXT,
  position         TEXT,

  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendees_enrollment
  ON offline_attendees(enrollment_id)
  WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendees_user
  ON offline_attendees(user_id)
  WHERE user_id IS NOT NULL AND cancelled_at IS NULL;


-- ────────────────────────────────────────
-- 3-6. offline_waitlist (순번은 컬럼 X, created_at 동적)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_waitlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  attendee_count   INT NOT NULL DEFAULT 1 CHECK (attendee_count >= 1),

  notified_at            TIMESTAMPTZ,
  reservation_deadline   TIMESTAMPTZ,

  status           TEXT NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'notified', 'converted', 'expired')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session_order
  ON offline_waitlist(session_id, created_at)
  WHERE status IN ('waiting', 'notified');


-- ────────────────────────────────────────
-- 3-7. offline_attendance (NULL UNIQUE 우회 — partial index)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_day_id      UUID NOT NULL REFERENCES offline_session_days(id) ON DELETE CASCADE,
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id) ON DELETE CASCADE,

  status              TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),

  checked_at          TIMESTAMPTZ,
  checked_by          TEXT NOT NULL CHECK (checked_by IN ('self_qr', 'admin')),
  checked_by_admin_id UUID REFERENCES profiles(id),

  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 정확히 user_id 또는 attendee_id 하나만
  CONSTRAINT attendance_subject_exclusive CHECK (
    (user_id IS NOT NULL AND attendee_id IS NULL)
    OR
    (user_id IS NULL AND attendee_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_user
  ON offline_attendance(session_day_id, enrollment_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_attendee
  ON offline_attendance(session_day_id, enrollment_id, attendee_id)
  WHERE attendee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment
  ON offline_attendance(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_day
  ON offline_attendance(session_day_id);


-- ────────────────────────────────────────
-- 3-8. offline_certificates
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE RESTRICT,

  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id),

  certificate_number  TEXT NOT NULL UNIQUE,
  attendance_rate     INT NOT NULL CHECK (attendance_rate BETWEEN 0 AND 100),

  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_url             TEXT,

  CONSTRAINT certificates_subject_exclusive CHECK (
    (user_id IS NOT NULL AND attendee_id IS NULL)
    OR
    (user_id IS NULL AND attendee_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_unique_user
  ON offline_certificates(enrollment_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_unique_attendee
  ON offline_certificates(enrollment_id, attendee_id)
  WHERE attendee_id IS NOT NULL;


-- ────────────────────────────────────────
-- 3-9. offline_notifications (중복 발송 방지)
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

  scheduled_at    TIMESTAMPTZ NOT NULL,

  subject         TEXT,
  body            TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message   TEXT,

  -- retry 추적 (cron 이 max 3회까지 재시도 후 abandon)
  retry_count     INT NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_due
  ON offline_notifications(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON offline_notifications(user_id, in_app_read_at)
  WHERE 'in_app' = ANY(channels);
-- 중복 발송 방지: 같은 enrollment 에 같은 type 알림 1건만
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_no_duplicate
  ON offline_notifications(enrollment_id, type)
  WHERE enrollment_id IS NOT NULL;


-- ────────────────────────────────────────
-- 3-10. offline_refunds (Q6 ② — 부분 환불 이력)
-- ────────────────────────────────────────
-- 한 enrollment 에 여러 번 부분 환불 가능 (단체 부분 취소 / 회차별 환불 등).
-- enrollment.refund_amount 는 누적 합 (트리거에서 자동 갱신).
CREATE TABLE IF NOT EXISTS offline_refunds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  -- 환불 사유 / 대상
  reason          TEXT NOT NULL CHECK (reason IN (
                    'user_cancellation',     -- 사용자 자발 취소
                    'admin_cancellation',    -- 관리자 취소
                    'attendee_partial',      -- 단체 부분 취소
                    'session_cancelled',     -- 회차 자체 취소
                    'system_expired'         -- 결제 기한 만료 (실제 환불액 0이지만 로그)
                  )),
  -- 단체 부분 취소 시 어떤 attendee
  attendee_id     UUID REFERENCES offline_attendees(id) ON DELETE SET NULL,

  amount          INT NOT NULL CHECK (amount >= 0),
  rate            INT NOT NULL CHECK (rate BETWEEN 0 AND 100),

  -- 처리자
  processed_by    UUID REFERENCES profiles(id),
  processed_by_type TEXT NOT NULL CHECK (processed_by_type IN ('user', 'admin', 'system')),

  -- Stripe 환불 ID (카드 환불)
  stripe_refund_id TEXT,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_enrollment
  ON offline_refunds(enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_attendee
  ON offline_refunds(attendee_id)
  WHERE attendee_id IS NOT NULL;


-- ────────────────────────────────────────
-- 3-11. offline_audit_log
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,

  action        TEXT NOT NULL,

  actor_user_id UUID REFERENCES profiles(id),
  actor_type    TEXT CHECK (actor_type IN ('user', 'admin', 'system')),

  diff          JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata      JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON offline_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON offline_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action
  ON offline_audit_log(action, created_at DESC);


-- ────────────────────────────────────────
-- 4. 비즈니스 함수
-- ────────────────────────────────────────

-- 보강 D: GROUP BY id, capacity 명시
-- 잔여석 (외부 공개 — confirmed 만 차감)
CREATE OR REPLACE FUNCTION offline_session_available_seats(p_session_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT s.capacity - COALESCE(SUM(
    CASE
      WHEN e.applicant_type = 'individual' THEN 1
      WHEN e.applicant_type = 'corporate'  THEN (
        SELECT COUNT(*)::INT
        FROM offline_attendees a
        WHERE a.enrollment_id = e.id
          AND a.cancelled_at IS NULL
      )
    END
  ), 0)::INT
  FROM offline_sessions s
  LEFT JOIN offline_enrollments e
    ON e.session_id = s.id
   AND e.status = 'confirmed'
   AND e.deleted_at IS NULL
  WHERE s.id = p_session_id
    AND s.deleted_at IS NULL
  GROUP BY s.id, s.capacity;
$$;

-- 관리자용 — 결제 대기 포함 breakdown
CREATE OR REPLACE FUNCTION offline_session_seat_breakdown(p_session_id UUID)
RETURNS TABLE (
  capacity      INT,
  confirmed     INT,
  pending       INT,
  total_seats   INT,
  available     INT
)
LANGUAGE sql
STABLE
AS $$
  WITH counts AS (
    SELECT
      CASE WHEN e.applicant_type = 'individual'
           THEN 1
           ELSE (SELECT COUNT(*)::INT
                 FROM offline_attendees a
                 WHERE a.enrollment_id = e.id
                   AND a.cancelled_at IS NULL)
      END AS seats,
      e.status
    FROM offline_enrollments e
    WHERE e.session_id = p_session_id
      AND e.deleted_at IS NULL
      AND e.status IN ('confirmed', 'pending_payment')
  )
  SELECT
    s.capacity,
    COALESCE(SUM(CASE WHEN c.status = 'confirmed'       THEN c.seats END), 0)::INT,
    COALESCE(SUM(CASE WHEN c.status = 'pending_payment' THEN c.seats END), 0)::INT,
    COALESCE(SUM(c.seats), 0)::INT,
    s.capacity - COALESCE(SUM(CASE WHEN c.status = 'confirmed' THEN c.seats END), 0)::INT
  FROM offline_sessions s
  LEFT JOIN counts c ON true
  WHERE s.id = p_session_id
  GROUP BY s.id, s.capacity;
$$;

-- 보강 A: SECURITY DEFINER + search_path 고정 (RLS 우회 — INSERT 가능)
-- Q3: KST 23:59:59 결제 기한 계산
CREATE OR REPLACE FUNCTION offline_create_enrollment(
  p_session_id     UUID,
  p_applicant_id   UUID,
  p_applicant_type TEXT,
  p_attendee_count INT,
  p_company_id     UUID,
  p_payment_method TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session         offline_sessions%ROWTYPE;
  v_available       INT;
  v_unit_price      INT;
  v_total           INT;
  v_payment_due     TIMESTAMPTZ;
  v_due_signup      TIMESTAMPTZ;
  v_due_before      TIMESTAMPTZ;
  v_deadline_days   INT;
  v_deadline_before INT;
  v_enrollment_id   UUID;
BEGIN
  -- 회차 행 락 (동시 신청 직렬화)
  SELECT * INTO v_session
    FROM offline_sessions
    WHERE id = p_session_id AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '회차를 찾을 수 없음 (id=%)', p_session_id;
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION '신청 가능한 회차가 아님 (status=%)', v_session.status;
  END IF;

  IF p_applicant_type = 'corporate' AND p_company_id IS NULL THEN
    RAISE EXCEPTION '기업 신청은 company_id 가 필요함';
  END IF;

  -- 잔여석 검증 (가확보는 카운팅 제외 — confirmed 만 차감)
  v_available := offline_session_available_seats(p_session_id);
  IF v_available < p_attendee_count THEN
    RAISE EXCEPTION '잔여석 부족 (요청 %, 잔여 %)', p_attendee_count, v_available;
  END IF;

  -- 결제 기한 — 회차별 override 또는 글로벌 settings
  v_deadline_days   := COALESCE(v_session.payment_deadline_days,
                        (SELECT value::INT FROM site_settings
                         WHERE key = 'offline_payment_deadline_days'));
  v_deadline_before := COALESCE(v_session.payment_deadline_before_start,
                        (SELECT value::INT FROM site_settings
                         WHERE key = 'offline_payment_deadline_before_start'));

  -- Q3: 신청일 + N일 의 23:59:59 KST
  v_due_signup := (
    ((CURRENT_DATE + (v_deadline_days || ' days')::INTERVAL)::DATE
      + TIME '23:59:59') AT TIME ZONE 'Asia/Seoul'
  );
  -- 강좌 시작일 - N일 의 00:00 KST
  v_due_before := (
    ((v_session.start_date - (v_deadline_before || ' days')::INTERVAL)::DATE
      + TIME '00:00:00') AT TIME ZONE 'Asia/Seoul'
  );
  v_payment_due := LEAST(v_due_signup, v_due_before);

  -- payment_due_at 가 이미 과거 (강좌 시작 임박) 이면 신청 차단
  IF v_payment_due <= now() THEN
    RAISE EXCEPTION '강좌 시작이 임박해 신청 마감됨 (payment_due_at=%)', v_payment_due;
  END IF;

  -- Q1/Q2: 단순 곱셈 + vat_included 회차값 그대로 스냅샷
  v_unit_price := v_session.price;
  v_total      := v_unit_price * p_attendee_count;

  INSERT INTO offline_enrollments (
    session_id, applicant_user_id, applicant_type, company_id,
    attendee_count, status,
    payment_method, unit_price, total_amount, vat_included,
    payment_due_at, refund_policy_snapshot
  ) VALUES (
    p_session_id, p_applicant_id, p_applicant_type, p_company_id,
    p_attendee_count, 'pending_payment',
    p_payment_method, v_unit_price, v_total, v_session.vat_included,
    v_payment_due, v_session.refund_policy
  )
  RETURNING id INTO v_enrollment_id;

  -- 감사 로그
  INSERT INTO offline_audit_log (entity_type, entity_id, action, actor_user_id, actor_type, diff)
  VALUES (
    'enrollment', v_enrollment_id, 'created', p_applicant_id, 'user',
    jsonb_build_object(
      'session_id', p_session_id,
      'attendee_count', p_attendee_count,
      'unit_price', v_unit_price,
      'total_amount', v_total,
      'payment_due_at', v_payment_due
    )
  );

  RETURN v_enrollment_id;
END;
$$;


-- ────────────────────────────────────────
-- 5. 트리거
-- ────────────────────────────────────────

-- 5-1. updated_at 자동 갱신 — 모든 도메인 테이블에 적용
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'offline_programs', 'offline_sessions', 'offline_session_days',
    'offline_enrollments', 'offline_attendees', 'offline_waitlist',
    'offline_attendance'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t);
  END LOOP;
END $$;

-- 5-2. Enrollment 상태 전이 검증
CREATE OR REPLACE FUNCTION validate_enrollment_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valid_transitions JSONB := '{
    "pending_payment": ["confirmed", "cancelled", "expired"],
    "confirmed":       ["refunded"],
    "expired":         [],
    "cancelled":       [],
    "refunded":        []
  }'::jsonb;
  v_allowed JSONB;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_allowed := v_valid_transitions -> OLD.status;
    -- JSONB array 에 NEW.status 가 있는지 체크
    IF NOT (v_allowed @> to_jsonb(NEW.status)) THEN
      RAISE EXCEPTION '유효하지 않은 enrollment 상태 전이: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_status_transition ON offline_enrollments;
CREATE TRIGGER trg_enrollment_status_transition
  BEFORE UPDATE OF status ON offline_enrollments
  FOR EACH ROW EXECUTE FUNCTION validate_enrollment_status_transition();

-- 5-3. QR 활성 시간 자동 계산 (보강 C — timezone 캐스팅 명확화)
CREATE OR REPLACE FUNCTION set_qr_active_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_window_minutes INT;
  v_start_ts       TIMESTAMPTZ;
BEGIN
  v_window_minutes := COALESCE(
    (SELECT value::INT FROM site_settings WHERE key = 'offline_qr_window_minutes'),
    30
  );

  -- 회차 일자의 KST 시작 시각을 TIMESTAMPTZ 로 변환
  v_start_ts := ((NEW.date + NEW.start_time) AT TIME ZONE 'Asia/Seoul');

  NEW.qr_active_from  := v_start_ts - (v_window_minutes || ' minutes')::INTERVAL;
  NEW.qr_active_until := v_start_ts + (v_window_minutes || ' minutes')::INTERVAL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_day_qr_window ON offline_session_days;
CREATE TRIGGER trg_session_day_qr_window
  BEFORE INSERT OR UPDATE OF date, start_time ON offline_session_days
  FOR EACH ROW EXECUTE FUNCTION set_qr_active_window();

-- 5-4. 단체 신청 인원 sync (보강 E — 0 허용)
CREATE OR REPLACE FUNCTION sync_enrollment_attendee_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_enrollment_id UUID;
  v_count INT;
  v_app_type TEXT;
BEGIN
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  SELECT applicant_type INTO v_app_type
    FROM offline_enrollments
    WHERE id = v_enrollment_id;

  -- 개인 신청은 sync 안 함
  IF v_app_type <> 'corporate' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM offline_attendees
    WHERE enrollment_id = v_enrollment_id
      AND cancelled_at IS NULL;

  -- attendee_count CHECK 가 >= 0 으로 완화돼 있어 안전
  UPDATE offline_enrollments
    SET attendee_count = v_count
    WHERE id = v_enrollment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_attendees_sync_count ON offline_attendees;
CREATE TRIGGER trg_attendees_sync_count
  AFTER INSERT OR UPDATE OF cancelled_at OR DELETE ON offline_attendees
  FOR EACH ROW EXECUTE FUNCTION sync_enrollment_attendee_count();

-- 5-5. 감사 로그 자동 기록 (enrollment 상태 변경)
CREATE OR REPLACE FUNCTION log_enrollment_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_actor_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_actor_type := CASE
      WHEN auth.uid() IS NULL THEN 'system'
      WHEN is_offline_admin() THEN 'admin'
      ELSE 'user'
    END;

    INSERT INTO offline_audit_log (entity_type, entity_id, action, actor_user_id, actor_type, diff)
    VALUES (
      'enrollment', NEW.id,
      CASE NEW.status
        WHEN 'confirmed' THEN 'payment_confirmed'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'expired'   THEN 'expired'
        WHEN 'refunded'  THEN 'refunded'
        ELSE 'status_changed'
      END,
      auth.uid(),
      v_actor_type,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_audit ON offline_enrollments;
CREATE TRIGGER trg_enrollment_audit
  AFTER UPDATE ON offline_enrollments
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_changes();

-- 5-6. 환불 누적액 sync (offline_refunds → enrollment.refund_amount)
CREATE OR REPLACE FUNCTION sync_enrollment_refund_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_enrollment_id UUID;
  v_total INT;
BEGIN
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM offline_refunds
    WHERE enrollment_id = v_enrollment_id;

  UPDATE offline_enrollments
    SET refund_amount = NULLIF(v_total, 0),
        refunded_at   = CASE WHEN v_total > 0 THEN COALESCE(refunded_at, now()) ELSE NULL END
    WHERE id = v_enrollment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refunds_sync_total ON offline_refunds;
CREATE TRIGGER trg_refunds_sync_total
  AFTER INSERT OR UPDATE OR DELETE ON offline_refunds
  FOR EACH ROW EXECUTE FUNCTION sync_enrollment_refund_total();


-- ────────────────────────────────────────
-- 6. RLS — 모든 테이블 enable + policies
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
ALTER TABLE offline_refunds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_audit_log      ENABLE ROW LEVEL SECURITY;

-- ── offline_programs ──
DROP POLICY IF EXISTS programs_public_read ON offline_programs;
CREATE POLICY programs_public_read
  ON offline_programs FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);
DROP POLICY IF EXISTS programs_staff_all ON offline_programs;
CREATE POLICY programs_staff_all
  ON offline_programs FOR ALL
  USING (is_offline_staff());

-- ── offline_sessions ──
DROP POLICY IF EXISTS sessions_public_read ON offline_sessions;
CREATE POLICY sessions_public_read
  ON offline_sessions FOR SELECT
  USING (deleted_at IS NULL AND status IN ('open', 'closed', 'completed'));
DROP POLICY IF EXISTS sessions_staff_all ON offline_sessions;
CREATE POLICY sessions_staff_all
  ON offline_sessions FOR ALL
  USING (is_offline_staff());

-- ── offline_session_days (QR 토큰 노출 차단) ──
DROP POLICY IF EXISTS session_days_enrolled_read ON offline_session_days;
CREATE POLICY session_days_enrolled_read
  ON offline_session_days FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.session_id = offline_session_days.session_id
      AND e.applicant_user_id = auth.uid()
      AND e.status = 'confirmed'
      AND e.deleted_at IS NULL));
DROP POLICY IF EXISTS session_days_staff_all ON offline_session_days;
CREATE POLICY session_days_staff_all
  ON offline_session_days FOR ALL
  USING (is_offline_staff());

-- ── offline_enrollments ──
DROP POLICY IF EXISTS enrollments_owner_read ON offline_enrollments;
CREATE POLICY enrollments_owner_read
  ON offline_enrollments FOR SELECT
  USING (applicant_user_id = auth.uid());
DROP POLICY IF EXISTS enrollments_staff_all ON offline_enrollments;
CREATE POLICY enrollments_staff_all
  ON offline_enrollments FOR ALL
  USING (is_offline_staff());

-- ── offline_attendees ──
DROP POLICY IF EXISTS attendees_owner_read ON offline_attendees;
CREATE POLICY attendees_owner_read
  ON offline_attendees FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.id = offline_attendees.enrollment_id
      AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS attendees_self_linked_read ON offline_attendees;
CREATE POLICY attendees_self_linked_read
  ON offline_attendees FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS attendees_staff_all ON offline_attendees;
CREATE POLICY attendees_staff_all
  ON offline_attendees FOR ALL
  USING (is_offline_staff());

-- ── offline_waitlist ──
DROP POLICY IF EXISTS waitlist_owner_read ON offline_waitlist;
CREATE POLICY waitlist_owner_read
  ON offline_waitlist FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS waitlist_staff_all ON offline_waitlist;
CREATE POLICY waitlist_staff_all
  ON offline_waitlist FOR ALL
  USING (is_offline_staff());

-- ── offline_attendance ──
DROP POLICY IF EXISTS attendance_owner_read ON offline_attendance;
CREATE POLICY attendance_owner_read
  ON offline_attendance FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_attendance.enrollment_id
        AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS attendance_staff_all ON offline_attendance;
CREATE POLICY attendance_staff_all
  ON offline_attendance FOR ALL
  USING (is_offline_staff());

-- ── offline_certificates ──
DROP POLICY IF EXISTS certificates_owner_read ON offline_certificates;
CREATE POLICY certificates_owner_read
  ON offline_certificates FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_certificates.enrollment_id
        AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS certificates_staff_all ON offline_certificates;
CREATE POLICY certificates_staff_all
  ON offline_certificates FOR ALL
  USING (is_offline_staff());

-- ── offline_notifications ──
DROP POLICY IF EXISTS notifications_owner_read ON offline_notifications;
CREATE POLICY notifications_owner_read
  ON offline_notifications FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_owner_update ON offline_notifications;
CREATE POLICY notifications_owner_update
  ON offline_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_staff_all ON offline_notifications;
CREATE POLICY notifications_staff_all
  ON offline_notifications FOR ALL
  USING (is_offline_staff());

-- ── offline_refunds ──
DROP POLICY IF EXISTS refunds_owner_read ON offline_refunds;
CREATE POLICY refunds_owner_read
  ON offline_refunds FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.id = offline_refunds.enrollment_id
      AND e.applicant_user_id = auth.uid()));
DROP POLICY IF EXISTS refunds_staff_all ON offline_refunds;
CREATE POLICY refunds_staff_all
  ON offline_refunds FOR ALL
  USING (is_offline_admin());  -- 환불은 admin/superadmin 만 (instructor 제외)

-- ── offline_audit_log (admin 만 조회) ──
DROP POLICY IF EXISTS audit_admin_only ON offline_audit_log;
CREATE POLICY audit_admin_only
  ON offline_audit_log FOR SELECT
  USING (is_offline_admin());
