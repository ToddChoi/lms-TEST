# 오프라인 교육 신청·운영 기능 명세

> 프로젝트: Ingrow LMS  
> 작성일: 2026-05-11  
> 목적: 온라인 강좌와 별개로 오프라인 교육(워크샵, 정규과정, 기업맞춤)을 신청·결제·운영할 수 있는 기능 추가

---

## 목차

1. [개요](#1-개요)
2. [핵심 의사결정 요약](#2-핵심-의사결정-요약)
3. [DB 스키마 추가](#3-db-스키마-추가)
4. [관리자 메뉴 구조](#4-관리자-메뉴-구조)
5. [공개 페이지 구조](#5-공개-페이지-구조)
6. [기능 상세 — 관리자](#6-기능-상세--관리자)
7. [기능 상세 — 공개/사용자](#7-기능-상세--공개사용자)
8. [API Routes 추가](#8-api-routes-추가)
9. [자동화 작업 (Cron Jobs)](#9-자동화-작업-cron-jobs)
10. [알림 시스템](#10-알림-시스템)
11. [환경변수 추가](#11-환경변수-추가)
12. [구현 순서 (Phase별 로드맵)](#12-구현-순서-phase별-로드맵)

---

## 1. 개요

### 배경

- 현재 Ingrow LMS는 온라인 강좌(영상 학습) 중심으로 설계되어 있음
- B2B 고객사 요구로 **오프라인 교육(집합 교육·워크샵)** 운영이 필요함
- 오프라인 교육은 정원·일정·장소·출결 등 온라인과 운영 방식이 근본적으로 달라 별도 영역으로 설계해야 함

### 목표

- 온라인 강좌와 **완전 분리된** 메뉴·DB·운영 흐름을 구축함
- 동일 LMS·동일 계정 체계 내에서 운영하되, 화면·테이블·관리자 메뉴는 모두 독립함
- 단발 워크샵·정규 과정·기업 출장교육을 모두 한 시스템에서 다룸
- 개인 신청과 기업 단체 신청을 모두 지원하며, 카드 결제와 세금계산서 후불을 혼재 지원함
- 신청부터 수료까지 전 과정을 **풀 자동화**하여 운영자 개입을 최소화함

### 범위 외 (Not in Scope)

- 온라인 강좌 영역은 변경하지 않음 (기존 `courses`/`enrollments` 테이블 그대로 유지)
- 기존 `certificates` 테이블은 그대로 두고, 오프라인 수료증은 별도 테이블로 운영함
- 출장교육의 견적·계약 관리 흐름은 별도 단계에서 추가 검토함

---

## 2. 핵심 의사결정 요약

| 항목 | 결정 내용 |
|------|---------|
| 시스템 분리 | 온라인 강좌와 **완전 분리** (메뉴·DB·관리 영역 독립) |
| 지원 형태 | 단발 워크샵 / 정규 과정 / 기업 맞춤(출장) — 1 프로그램 = N 회차 구조 |
| 신청 주체 | 개인 직접 신청 + 기업 담당자 단체 등록 |
| 결제 방식 | 카드 즉시 결제(개인) + 세금계산서 후불(기업) 혼재 지원 |
| 자리 잡기 | **하이브리드 가확보 모델** — 가확보는 정원 카운팅에 영향 없음 |
| 결제 기한 | "신청 후 N일" vs "강좌 시작 N일 전" 중 **더 빠른 쪽** (관리자 설정) |
| 기한 만료 | 3일 전·1일 전 알림 → 만료일 자동 취소 |
| 대기열 | 자동 등록 — 자리 발생 시 1순위에게 자동 알림, 기한 내 미결제 시 다음 순위 |
| 환불 정책 | 단계별 자동 (7일 전 100% / 3~6일 전 50% / 2일~당일 0%) |
| 단체 부분취소 | 수업 시작 전까지만 가능, 시작 후 불가 |
| 출결 방식 | QR 자동 + 관리자 사후 보정 가능 |
| 수료 조건 | 출석률 N% 이상 (강좌별 설정) |
| 안내 채널 | 이메일 + SMS + 사이트 알림함 (3채널 동시 발송) |

---

## 3. DB 스키마 추가

> ⚠️ **본 §3 의 SQL 블록은 v1 초안이며, v2 데이터 모델 (`docs/DATA_MODEL_OFFLINE_V2.md`) 로 전면 대체됐습니다.**
> 실제 적용 마이그레이션: **`supabase/migration_offline_v2.sql`**
>
> v2 가 v1 대비 보강:
> - 가격/환불 정책 신청 시점 스냅샷 (관리자 정책 변경이 기존 신청자에 소급 X)
> - 정원 동시성 (DB 함수 + `FOR UPDATE` 행 락)
> - 상태 전이 트리거 검증
> - 모든 도메인 테이블 `deleted_at` soft delete + RESTRICT 기본
> - `offline_refunds` 환불 이력 별도 테이블
> - `offline_audit_log` 감사 로그 신규
> - `is_offline_admin()` / `is_offline_staff()` 헬퍼 (RLS 표현 단순화)
>
> 이전 v1 마이그레이션 (`supabase/migration_offline.sql`, commit `9f1a877`) 은 **Supabase 적용 전 폐기 → git rm**. 본 §3 SQL 도 참고용으로만 유지.

Supabase SQL Editor에서 아래 마이그레이션 실행.  
파일 위치: ~~`supabase/migration_offline.sql`~~ → **`supabase/migration_offline_v2.sql`**

```sql
-- ────────────────────────────────────────
-- 1. 오프라인 프로그램 (강좌 마스터)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_url   TEXT,

  -- 프로그램 형태
  program_type    TEXT NOT NULL CHECK (program_type IN (
                    'workshop',        -- 단발 워크샵
                    'regular_course',  -- 정규 과정 (여러 회차 묶음)
                    'corporate'        -- 기업 맞춤(출장)
                  )),

  -- 강사 정보
  instructor_name TEXT,
  instructor_bio  TEXT,

  -- 상세 정보
  what_you_learn   TEXT[] DEFAULT '{}',
  requirements     TEXT[] DEFAULT '{}',
  target_audience  TEXT,

  -- 수료 조건 (출석률 %)
  completion_attendance_rate INT NOT NULL DEFAULT 80,

  -- 노출/관리
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'closed')),
  is_featured     BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_programs_status   ON offline_programs(status);
CREATE INDEX IF NOT EXISTS idx_offline_programs_category ON offline_programs(category_id);

-- ────────────────────────────────────────
-- 2. 회차 (Session) — 한 프로그램이 N번 개설
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES offline_programs(id) ON DELETE CASCADE,

  title           TEXT,                 -- 예: "10월차", "1기"
  start_date      DATE NOT NULL,        -- 회차 시작일
  end_date        DATE NOT NULL,        -- 회차 종료일 (단발이면 = start_date)

  capacity        INT NOT NULL,         -- 정원
  price           INT NOT NULL DEFAULT 0,

  -- 장소
  location_name    TEXT,                 -- 예: "강남 본사 5층 교육장"
  location_address TEXT,
  location_url     TEXT,                 -- 지도 링크

  -- 결제 정책 (NULL이면 글로벌 site_settings 사용)
  payment_deadline_days          INT,
  payment_deadline_before_start  INT,

  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'cancelled', 'completed')),

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_sessions_program     ON offline_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_start_date  ON offline_sessions(start_date);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_status      ON offline_sessions(status);

-- ────────────────────────────────────────
-- 3. 회차 일자 (Session Days) — 정규과정처럼 여러 날로 진행되는 경우
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_session_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,

  day_number      INT NOT NULL,        -- 1일차, 2일차
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  topic           TEXT,

  -- QR 출결
  -- ★ P0 보안: qr_token 은 추측 불가능해야 함. lib/offline/qr.ts 가
  --    crypto.randomBytes(32).toString('base64url') 로 생성 (256-bit entropy).
  --    sequential / timestamp 기반 토큰 절대 X.
  qr_token        TEXT UNIQUE,         -- 일자별 고유 토큰 (생성 시 자동 발급)
  qr_active_from  TIMESTAMPTZ,         -- QR 활성화 시작 (보통 시작 N분 전)
  qr_active_until TIMESTAMPTZ,         -- QR 활성화 종료 (보통 시작 N분 후)

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_session_days_session ON offline_session_days(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_session_days_qr      ON offline_session_days(qr_token);

-- ────────────────────────────────────────
-- 4. 신청 (Enrollment) — 개인/기업단체 모두 수용
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE RESTRICT,

  -- 신청자
  applicant_user_id UUID NOT NULL REFERENCES profiles(id),
  applicant_type    TEXT NOT NULL CHECK (applicant_type IN ('individual', 'corporate')),

  -- 기업 단체 신청일 경우
  company_id              UUID REFERENCES companies(id),
  company_contact_name    TEXT,
  company_contact_phone   TEXT,
  company_contact_email   TEXT,

  -- 참석 인원
  attendee_count   INT NOT NULL DEFAULT 1 CHECK (attendee_count >= 1),

  -- 상태
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                     CHECK (status IN (
                       'pending_payment',  -- 결제 대기 (가확보)
                       'confirmed',        -- 결제 완료 (자리 확정)
                       'expired',          -- 결제 기한 만료
                       'cancelled',        -- 사용자 취소
                       'refunded'          -- 환불 완료
                     )),

  -- 결제
  payment_method   TEXT CHECK (payment_method IN ('card', 'invoice')),
  total_amount     INT NOT NULL,
  payment_due_at   TIMESTAMPTZ NOT NULL,
  paid_at          TIMESTAMPTZ,

  -- 취소/환불
  cancelled_at     TIMESTAMPTZ,
  refunded_at      TIMESTAMPTZ,
  refund_amount    INT,
  refund_rate      INT,                -- 100, 50, 0

  -- Stripe 연동 (카드 결제 시)
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,

  -- 세금계산서 (invoice 결제 시)
  invoice_issued_at        TIMESTAMPTZ,
  invoice_number           TEXT,
  invoice_paid_confirmed_by UUID REFERENCES profiles(id),  -- 입금 확인한 관리자

  -- 메모
  notes            TEXT,

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_enrollments_session       ON offline_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_applicant     ON offline_enrollments(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_company       ON offline_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_status        ON offline_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_offline_enrollments_payment_due   ON offline_enrollments(payment_due_at);

-- ────────────────────────────────────────
-- 5. 단체 신청 참석자
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  department      TEXT,
  position        TEXT,

  -- 결제 확정 후 LMS 회원과 매칭되면 user_id 채워짐
  user_id         UUID REFERENCES profiles(id),

  -- 부분 취소
  cancelled_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_attendees_enrollment ON offline_attendees(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_offline_attendees_user       ON offline_attendees(user_id);

-- ────────────────────────────────────────
-- 6. 대기열 (Waitlist)
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_waitlist (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES offline_sessions(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES profiles(id),

  attendee_count         INT NOT NULL DEFAULT 1,
  position               INT NOT NULL,            -- 대기 순번

  -- 자리 발생 시 알림 처리
  notified_at            TIMESTAMPTZ,
  reservation_deadline   TIMESTAMPTZ,             -- 알림 받은 시점 + N시간

  status                 TEXT NOT NULL DEFAULT 'waiting'
                           CHECK (status IN (
                             'waiting',     -- 대기 중
                             'notified',    -- 자리 발생 알림 발송됨
                             'converted',   -- 결제로 전환됨
                             'expired'      -- 알림 후 기한 내 미응답
                           )),

  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),

  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_waitlist_session ON offline_waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_waitlist_status  ON offline_waitlist(status);

-- ────────────────────────────────────────
-- 7. 출석 기록
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_attendance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_day_id      UUID NOT NULL REFERENCES offline_session_days(id) ON DELETE CASCADE,
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id) ON DELETE CASCADE,

  -- 출석 대상 (개인이면 user_id, 단체면 attendee_id 채워짐)
  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id),

  status              TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),

  checked_at          TIMESTAMPTZ,
  checked_by          TEXT NOT NULL CHECK (checked_by IN ('self_qr', 'admin')),
  checked_by_admin_id UUID REFERENCES profiles(id),

  notes               TEXT,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE (session_day_id, enrollment_id, attendee_id),
  UNIQUE (session_day_id, enrollment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_attendance_day        ON offline_attendance(session_day_id);
CREATE INDEX IF NOT EXISTS idx_offline_attendance_enrollment ON offline_attendance(enrollment_id);

-- ────────────────────────────────────────
-- 8. 오프라인 수료증
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          UUID NOT NULL REFERENCES offline_programs(id),
  session_id          UUID NOT NULL REFERENCES offline_sessions(id),
  enrollment_id       UUID NOT NULL REFERENCES offline_enrollments(id),

  user_id             UUID REFERENCES profiles(id),
  attendee_id         UUID REFERENCES offline_attendees(id),

  certificate_number  TEXT NOT NULL UNIQUE,
  attendance_rate     INT NOT NULL,            -- 실제 출석률 (%)

  issued_at           TIMESTAMPTZ DEFAULT now(),
  pdf_url             TEXT
);

CREATE INDEX IF NOT EXISTS idx_offline_certificates_user    ON offline_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_certificates_session ON offline_certificates(session_id);

-- ────────────────────────────────────────
-- 9. 알림 발송 큐/로그
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offline_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  enrollment_id   UUID REFERENCES offline_enrollments(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id),

  type            TEXT NOT NULL CHECK (type IN (
                    'application_received',    -- 신청 접수
                    'payment_instruction',     -- 입금 안내 (invoice)
                    'payment_due_3days',       -- 결제 기한 3일 전
                    'payment_due_1day',        -- 결제 기한 1일 전
                    'payment_expired',         -- 결제 기한 만료
                    'payment_confirmed',       -- 결제 완료
                    'pre_event_2weeks',        -- 강좌 2주 전 사전 안내
                    'reminder_1day',           -- 1일 전 리마인더
                    'attendance_checked_in',   -- 출석 체크 완료
                    'certificate_issued',      -- 수료증 발급
                    'survey_request',          -- 만족도 조사 요청
                    'waitlist_available',      -- 대기열 자리 발생
                    'cancellation_confirmed',  -- 취소/환불 완료
                    'session_cancelled'        -- 강좌 자체 취소
                  )),

  -- 발송 채널 (배열)
  channels        TEXT[] NOT NULL DEFAULT '{email,sms,in_app}',

  -- 발송 결과
  email_sent_at   TIMESTAMPTZ,
  sms_sent_at     TIMESTAMPTZ,
  in_app_read_at  TIMESTAMPTZ,

  -- 예약 발송
  scheduled_at    TIMESTAMPTZ,

  -- 내용
  subject         TEXT,
  body            TEXT,

  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message   TEXT,

  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_notifications_scheduled ON offline_notifications(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_offline_notifications_user      ON offline_notifications(user_id);

-- ────────────────────────────────────────
-- 10. 글로벌 설정값 추가 (site_settings 활용)
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
-- 11. RLS 정책 — P0 보강 (모든 offline_* 테이블)
-- ────────────────────────────────────────
-- 원칙:
--   - 공개 카탈로그 (programs / sessions): public read (active 만), admin write
--   - 신청자 데이터 (enrollments / attendees / attendance / certificates / waitlist /
--     notifications): 본인만 read, admin/instructor 전체
--   - session_days 의 qr_token 노출 차단 — confirmed 신청자만 조회 가능
--   - INSERT/UPDATE/DELETE 는 가급적 service-role 또는 RPC 통해서만

ALTER TABLE offline_programs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_session_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_attendees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_waitlist       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_certificates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_notifications  ENABLE ROW LEVEL SECURITY;

-- ── 공개 카탈로그 ──
CREATE POLICY "offline_programs: public read active"
  ON offline_programs FOR SELECT USING (status = 'active');
CREATE POLICY "offline_programs: admin all"
  ON offline_programs FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_sessions: public read"
  ON offline_sessions FOR SELECT USING (status IN ('open', 'closed', 'completed'));
CREATE POLICY "offline_sessions: admin all"
  ON offline_sessions FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- session_days: QR 토큰 노출 차단 — confirmed 신청자 OR admin 만
CREATE POLICY "offline_session_days: enrolled read"
  ON offline_session_days FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.session_id = offline_session_days.session_id
      AND e.applicant_user_id = auth.uid()
      AND e.status = 'confirmed'));
CREATE POLICY "offline_session_days: admin all"
  ON offline_session_days FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ── 신청자 본인만 / admin 전체 ──
CREATE POLICY "offline_enrollments: self read"
  ON offline_enrollments FOR SELECT USING (applicant_user_id = auth.uid());
CREATE POLICY "offline_enrollments: admin all"
  ON offline_enrollments FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_attendees: enrollment owner read"
  ON offline_attendees FOR SELECT USING (EXISTS (
    SELECT 1 FROM offline_enrollments e
    WHERE e.id = offline_attendees.enrollment_id
      AND e.applicant_user_id = auth.uid()));
CREATE POLICY "offline_attendees: self linked read"
  ON offline_attendees FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "offline_attendees: admin all"
  ON offline_attendees FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_waitlist: self read"
  ON offline_waitlist FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "offline_waitlist: admin all"
  ON offline_waitlist FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_attendance: self read"
  ON offline_attendance FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_attendance.enrollment_id
        AND e.applicant_user_id = auth.uid()));
CREATE POLICY "offline_attendance: admin all"
  ON offline_attendance FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_certificates: self read"
  ON offline_certificates FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM offline_enrollments e
      WHERE e.id = offline_certificates.enrollment_id
        AND e.applicant_user_id = auth.uid()));
CREATE POLICY "offline_certificates: admin all"
  ON offline_certificates FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

CREATE POLICY "offline_notifications: self read"
  ON offline_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "offline_notifications: admin all"
  ON offline_notifications FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'instructor')));

-- ────────────────────────────────────────
-- 12. 동시성 / 멱등성 / 보안 보강 — P0 (Phase 2 시점 구현, 스키마 측 준비)
-- ────────────────────────────────────────
-- (a) Stripe Webhook 멱등성: stripe_session_id 가 NOT NULL 일 때 중복 INSERT 차단
CREATE UNIQUE INDEX IF NOT EXISTS offline_enrollments_stripe_session_unique
  ON offline_enrollments (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- (b) 동일 사용자가 동일 세션에 active enrollment 중복 방지 (취소/환불 후 재신청은 허용)
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

-- (d) 알림 retry 추적
ALTER TABLE offline_notifications
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;
```

---

## 4. 관리자 메뉴 구조

### 사이드바 추가 항목

`src/app/admin/layout.tsx`의 `ADMIN_NAV` 배열에 새 그룹 추가:

```ts
// "오프라인 교육" 그룹 (온라인 강좌 메뉴와 분리)
{ group: '오프라인 교육' },
{ label: '프로그램 관리',  icon: Briefcase,  href: '/admin/offline/programs' },
{ label: '회차 일정',       icon: Calendar,   href: '/admin/offline/sessions' },
{ label: '신청·결제 현황',  icon: CreditCard, href: '/admin/offline/enrollments' },
{ label: '대기열 관리',     icon: Clock,      href: '/admin/offline/waitlist' },
{ label: '출결 관리',       icon: CheckSquare,href: '/admin/offline/attendance' },
{ label: '오프라인 수료증', icon: Award,      href: '/admin/offline/certificates' },
{ label: '오프라인 설정',   icon: Settings,   href: '/admin/offline/settings' },
```

### 새로 생성할 파일 트리

```
src/app/admin/offline/
├── programs/
│   ├── page.tsx                       ← 프로그램 목록
│   ├── new/page.tsx                   ← 프로그램 생성
│   └── [id]/
│       ├── page.tsx                   ← 프로그램 상세/편집
│       └── sessions/
│           ├── page.tsx               ← 회차 목록 (해당 프로그램)
│           ├── new/page.tsx           ← 회차 생성
│           └── [sessionId]/
│               ├── page.tsx           ← 회차 상세/편집
│               ├── days/page.tsx      ← 회차 일자 관리
│               └── attendees/page.tsx ← 회차 신청자 명단
├── sessions/
│   └── page.tsx                       ← 전체 회차 일정 (캘린더 뷰)
├── enrollments/
│   ├── page.tsx                       ← 전체 신청·결제 현황
│   └── [id]/page.tsx                  ← 신청 상세 (입금 확인/취소/환불)
├── waitlist/
│   └── page.tsx                       ← 대기열 모니터링
├── attendance/
│   └── [sessionDayId]/page.tsx        ← 회차 일자별 출석부 (보정 가능)
├── certificates/
│   ├── page.tsx                       ← 발급 내역
│   └── new/page.tsx                   ← 일괄 발급
└── settings/
    └── page.tsx                       ← 오프라인 설정 (결제 기한·환불 정책 등)

src/app/(public)/offline/
├── page.tsx                           ← 오프라인 교육 목록
└── [slug]/
    ├── page.tsx                       ← 프로그램 상세 + 회차 선택
    └── apply/[sessionId]/page.tsx     ← 신청서

src/app/my/offline/
├── page.tsx                           ← 내 오프라인 신청 내역
└── [enrollmentId]/page.tsx            ← 신청 상세 (QR 체크인, 안내사항)

src/app/api/admin/offline/
├── programs/{route.ts, [id]/route.ts}
├── sessions/{route.ts, [id]/route.ts, [id]/days/route.ts}
├── enrollments/{route.ts, [id]/route.ts, [id]/confirm-payment/route.ts, [id]/cancel/route.ts}
├── waitlist/{route.ts, [id]/promote/route.ts}
├── attendance/{[sessionDayId]/route.ts}
├── certificates/{route.ts, issue/route.ts}
└── settings/route.ts

src/app/api/offline/
├── programs/route.ts                  ← 공개 프로그램 목록
├── sessions/[id]/route.ts             ← 회차 상세 (정원·잔여)
├── apply/route.ts                     ← 신청 (개인/기업 단체)
├── checkout/route.ts                  ← Stripe Checkout (카드 결제)
├── webhook/route.ts                   ← Stripe Webhook
├── waitlist/route.ts                  ← 대기열 등록
├── attendance/check-in/route.ts       ← QR 체크인
└── my/route.ts                        ← 내 신청 내역

src/lib/offline/
├── enrollment-state.ts                ← 신청 상태 전이 로직
├── seat-availability.ts               ← 정원·잔여 계산 (결제완료 기준)
├── payment-deadline.ts                ← 결제 기한 계산 (더 빠른 쪽)
├── refund-policy.ts                   ← 환불율 계산
├── waitlist.ts                        ← 대기열 자동 승격
├── notification-scheduler.ts          ← 알림 예약/발송
└── qr.ts                              ← QR 토큰 생성/검증

src/app/api/cron/offline/
├── expire-pending-payments/route.ts   ← 결제 기한 만료 자동 취소
├── send-payment-reminders/route.ts    ← 3일 전/1일 전 알림
├── send-pre-event-notice/route.ts     ← 강좌 2주 전 사전 안내
├── send-reminders/route.ts            ← 1일 전 리마인더
├── expire-waitlist-grace/route.ts     ← 대기열 결제 기한 만료 처리
└── send-pending-notifications/route.ts ← 알림 큐 발송
```

---

## 5. 공개 페이지 구조

### 헤더 메뉴 추가

CMS 네비게이션 메뉴(`nav_menus` 테이블)에 항목 추가:

```sql
INSERT INTO nav_menus (location, label, url, sort_order, is_visible) VALUES
  ('header', '오프라인 교육', '/offline', 50, true);
```

### 공개 페이지 라우트 요약

| 경로 | 설명 |
|------|------|
| `/offline` | 오프라인 교육 목록 (카테고리·유형 필터) |
| `/offline/[slug]` | 프로그램 상세 + 개설 회차 선택 |
| `/offline/[slug]/apply/[sessionId]` | 신청서 (개인/기업 선택) |
| `/my/offline` | 내 오프라인 신청 내역 |
| `/my/offline/[enrollmentId]` | 신청 상세 (QR 체크인·안내사항) |

---

## 6. 기능 상세 — 관리자

---

### 6-1. 프로그램 관리

**페이지 경로:** `/admin/offline/programs`

**기능 목록:**

- 프로그램 목록 테이블 (제목·유형·카테고리·상태·연결된 회차 수)
- 프로그램 추가/수정/삭제
- 상태 토글: `draft` / `active` / `closed`
- 추천(`is_featured`) 토글

**입력 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | text | 프로그램명 |
| `slug` | text | URL 슬러그 (자동/수동) |
| `description` | textarea | 설명 (마크다운) |
| `program_type` | select | workshop / regular_course / corporate |
| `category_id` | select | 카테고리 (기존 `categories` 테이블 연동) |
| `thumbnail_url` | image | 썸네일 |
| `instructor_name` | text | 강사명 |
| `instructor_bio` | textarea | 강사 소개 |
| `what_you_learn` | array | 학습 목표 (다중 입력) |
| `requirements` | array | 사전 요구사항 (다중 입력) |
| `target_audience` | textarea | 대상 |
| `completion_attendance_rate` | number | 수료 기준 출석률 (%) |
| `status` | select | draft / active / closed |
| `is_featured` | toggle | 추천 노출 |

---

### 6-2. 회차 관리

**페이지 경로:**
- 전체 보기: `/admin/offline/sessions`
- 프로그램별: `/admin/offline/programs/[id]/sessions`

**기능 목록:**

- 회차 목록 (제목·기간·장소·정원·결제완료/대기/잔여·상태)
- 회차 추가/수정/삭제
- 회차 일자(`offline_session_days`) 관리 — 정규과정의 경우 여러 일자 등록
- 회차 일자 생성 시 **QR 토큰 자동 발급**
- 결제 정책 오버라이드 (글로벌 설정 대신 회차별 별도 지정 가능)

**회차 생성 입력 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `program_id` | select | 어떤 프로그램의 회차인가 |
| `title` | text | "10월차", "1기" 등 (선택) |
| `start_date` | date | 시작일 |
| `end_date` | date | 종료일 (단발이면 = start_date) |
| `capacity` | number | 정원 |
| `price` | number | 가격 (원) |
| `location_name` | text | 장소명 |
| `location_address` | text | 주소 |
| `location_url` | text | 지도 링크 (선택) |
| `payment_deadline_days` | number | 결제 기한 (신청 후 N일) — 미입력 시 글로벌 설정 사용 |
| `payment_deadline_before_start` | number | 결제 기한 (시작 N일 전) — 미입력 시 글로벌 설정 사용 |

**회차 일자 입력 필드 (`offline_session_days`):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `day_number` | number | 1일차, 2일차 |
| `date` | date | 날짜 |
| `start_time` | time | 시작 시간 |
| `end_time` | time | 종료 시간 |
| `topic` | text | 해당 일자 주제 |

> QR 토큰(`qr_token`)은 일자 등록 시 서버에서 자동 발급. 활성화 시간(`qr_active_from`/`qr_active_until`)은 시작 시각 ± `offline_qr_window_minutes` 설정값 기준으로 자동 계산.

---

### 6-3. 신청·결제 현황

**페이지 경로:** `/admin/offline/enrollments`

**기능 목록:**

- 전체 신청 목록 (회차·신청자·인원·결제상태·결제기한·금액)
- **상태 필터**: 결제대기 / 결제완료 / 만료 / 취소 / 환불
- **회차 필터**: 특정 회차의 신청만 보기
- 회차별 모니터링 요약 카드:
  - 결제완료 인원 / 결제대기 인원 / 예상 합계 / 정원 / 잔여
- 신청 상세 페이지에서:
  - **입금 확인 처리** (`invoice` 결제 건) — 클릭 시 `status = confirmed`로 전이, 알림 자동 발송
  - **수동 취소** — 강좌 시작 전이면 환불율 계산 후 환불 처리, 시작 후면 환불 불가
  - **세금계산서 발행 처리** (외부 시스템 연동은 별도 구현 검토)
  - **단체 신청 참석자 명단** 보기/편집/부분 취소

**핵심 비즈니스 규칙:**

- 결제완료 인원으로만 정원 카운팅 (`status = confirmed` AND `cancelled_at IS NULL`)
- 가확보(`pending_payment`)는 운영자 화면에서만 별도 표시
- 부분 취소(`offline_attendees.cancelled_at`)는 강좌 시작 전까지만 허용
- 환불율: `lib/offline/refund-policy.ts`에서 강좌 시작일 기준 계산

---

### 6-4. 대기열 관리

**페이지 경로:** `/admin/offline/waitlist`

**기능 목록:**

- 회차별 대기열 목록 (순번·사용자·인원·등록일·상태)
- 자동 승격 로직은 cron에서 처리하되, 관리자가 **수동 승격**도 가능
- 알림 발송 이력 확인

---

### 6-5. 출결 관리

**페이지 경로:** `/admin/offline/attendance/[sessionDayId]`

**기능 목록:**

- 회차 일자별 출석부 표시 (참석자 명단 + 출결 상태)
- QR 자동 체크인 결과 표시 (`checked_by = 'self_qr'`)
- 관리자가 **사후 보정** 가능 — 상태 변경, 메모 추가
- 일괄 출결 처리 (모두 출석 / 미체크 일괄 결석 처리)
- CSV 내보내기

**UI 컬럼:**

| 컬럼 | 설명 |
|------|------|
| 이름 | 참석자명 |
| 소속 | 회사/부서 (해당 시) |
| 체크인 시각 | QR 또는 관리자 입력 시점 |
| 방식 | self_qr / admin |
| 상태 | present / absent / late |
| 메모 | 비고 |

---

### 6-6. 오프라인 수료증

**페이지 경로:** `/admin/offline/certificates`

**기능 목록:**

- 수료 가능 인원 자동 산출 — 회차 종료 후 `attendance_rate >= completion_attendance_rate` 인 신청자 추출
- 일괄 발급 — 선택한 회차의 수료 가능자 전원에게 수료증 발급
- 발급 시 `certificate_number` 자동 생성, PDF 생성 후 `pdf_url` 저장
- 발급 알림 자동 발송

**수료번호 포맷 예시:** `OFF-{YYYY}-{programCode}-{nnnn}`

---

### 6-7. 오프라인 설정

**페이지 경로:** `/admin/offline/settings`

**기능 목록:**

- `site_settings`의 `group_name = 'offline'` 그룹 값 편집
- 입금 계좌 정보 입력 (세금계산서 결제 안내용)
- 세금계산서 발행 정보(사업자등록번호 등) JSON 입력

**편집 가능 키:**

- `offline_payment_deadline_days`
- `offline_payment_deadline_before_start`
- `offline_refund_full_days`, `offline_refund_half_days`
- `offline_waitlist_grace_hours`
- `offline_qr_window_minutes`
- `offline_pre_event_notice_days`
- `offline_bank_account`
- `offline_invoice_company_info`

---

## 7. 기능 상세 — 공개/사용자

---

### 7-1. 오프라인 교육 목록

**페이지 경로:** `/offline`

**기능:**

- `offline_programs.status = 'active'` 인 프로그램 카드 그리드
- 카테고리 필터 + 프로그램 유형 필터(워크샵/정규/기업)
- 각 카드에 가장 가까운 개설 회차 1건 미리보기 (시작일·잔여석)
- 정렬: 시작일 가까운 순 / 최신 등록순

---

### 7-2. 프로그램 상세 + 회차 선택

**페이지 경로:** `/offline/[slug]`

**구성:**

- 프로그램 정보 (제목·설명·강사·학습목표·대상·요구사항)
- 개설 회차 리스트 — 회차별로:
  - 기간 (시작일~종료일)
  - 장소
  - 가격
  - **잔여석** = `capacity - count(confirmed enrollments)`
  - 잔여 0이면 "마감" 표시 + **대기 신청** 버튼
  - 잔여 있으면 "신청하기" 버튼 → `/offline/[slug]/apply/[sessionId]`

> 가확보(`pending_payment`)는 잔여석 계산에 포함되지 않음. 외부에는 결제완료 기준으로만 노출.

---

### 7-3. 신청서

**페이지 경로:** `/offline/[slug]/apply/[sessionId]`

**플로우:**

1. **신청 유형 선택** — 개인 / 기업 단체
2. **개인 신청** 흐름:
   - 신청자 정보 자동 채움 (로그인 프로필)
   - 결제 방식 선택: 카드 / 세금계산서
   - 카드 → Stripe Checkout으로 이동
   - 세금계산서 → 신청 완료, 입금 안내 페이지 표시
3. **기업 단체 신청** 흐름:
   - 회사 정보 입력 (자동 채움 + 수정 가능)
   - 담당자 연락처
   - 참석자 명단 입력 — 폼 또는 **CSV 업로드** (`offline_attendees` 다건 생성)
   - 결제 방식: 카드 / 세금계산서
   - 세금계산서 선택 시 사업자등록증·발행 정보 추가 입력

**핵심 비즈니스 규칙:**

- 신청 즉시 `offline_enrollments` 레코드 생성 (`status = pending_payment`)
- `payment_due_at` = `min(now() + N일, session.start_date - N일)`
- 신청 직후 **신청 접수 알림** 발송
- 세금계산서 결제 선택 시 **입금 안내 알림**(계좌번호 포함) 발송
- 카드 결제 → Stripe Webhook 수신 시 `status = confirmed`로 전이, **결제 완료 알림** 발송

**P0 보강 — 정원 동시성 (Phase 2 Stripe Webhook 시점):**

- `pending_payment` 단계에선 정원 검증 안 함 (가확보 모델 — 계속 들어옴 OK).
- `confirmed` 전이 시점 (Stripe Webhook / 입금 확인) 에서 정원 재검증 필수:

  ```sql
  -- service-role 트랜잭션 내에서:
  BEGIN;
    LOCK TABLE offline_enrollments IN SHARE ROW EXCLUSIVE MODE;
    -- 또는 SELECT ... FOR UPDATE 로 해당 session row 잠그기
    SELECT count(*) FROM offline_enrollments
      WHERE session_id = $1 AND status = 'confirmed' AND cancelled_at IS NULL;
    -- 합산 + attendee_count 가 capacity 초과면 → status = 'oversold' 같은 별도 상태로 전이
    -- + 자동 환불 + 알림 (관리자/사용자) + 대기열로 이동 권유
    UPDATE offline_enrollments SET status = 'confirmed', paid_at = now() WHERE id = $2;
  COMMIT;
  ```

- 정원 초과 발생 시 — 사용자 대상 별도 사과/환불 흐름 필요. 운영 정책 결정 후 구현.

**P0 보강 — Stripe Webhook 멱등성 (Phase 2):**

- Stripe 는 동일 event 를 여러 번 보낼 수 있음 (재시도, ack timeout).
- `offline_enrollments.stripe_session_id` 에 partial UNIQUE index 깔려있음 (§3 §12 (a)).
- Webhook 핸들러는 항상 `INSERT ... ON CONFLICT DO NOTHING` 또는 사전 `SELECT` 후 idempotent 처리.
- 추가로 Stripe `event.id` 단위 중복 차단을 위한 별도 `processed_stripe_events(event_id PK)` 테이블 권장.

**P0 보강 — CSV 업로드 가드 (Phase 3 — 기업 단체):**

- 파일 크기: ≤ 1MB
- 행 수: ≤ 500 (한 회차 정원 보다 클 일 거의 없음)
- 인코딩: UTF-8 (BOM 허용), Windows ANSI 도 fallback 시도
- **CSV Injection 차단**: 셀 값이 `=`, `+`, `-`, `@`, TAB, CR 로 시작하면 prefix 로 `'` 추가 (Excel 에서 formula 실행 차단)
- 필수 헤더: `name`. 선택: `email`, `phone`, `department`, `position`. 추가 컬럼은 무시.
- 파싱 에러 시 — 행 번호 + 사유 명시한 에러 응답 (사용자가 어디 고쳐야 할지 알아야 함)

**P1 — 결제 기한 엣지 (Phase 2):**

- 강좌 시작 ≤ 1일 회차에 신청 들어오면 `payment_due_at` 가 음수가 될 수 있음.
- 신청 폼에서 사전 차단: `session.start_date - now() < 24h` 면 신청 버튼 비활성 + 안내 ("신청 마감").
- 또는 `payment_due_at = max(now() + 1h, ...)` 같은 최소값 보장. 사용자 결정 필요.

---

### 7-4. 마이페이지: 오프라인 수강 내역

**페이지 경로:** `/my/offline`

**기능:**

- 내가 신청한 오프라인 교육 목록
- 상태별 필터 (결제대기 / 확정 / 종료 / 취소)
- 카드 클릭 시 상세 페이지로 이동

**상세 페이지 (`/my/offline/[enrollmentId]`):**

- 신청 정보·결제 상태·결제 기한 카운트다운
- (세금계산서 결제 대기인 경우) 입금 계좌 안내 + 신청 취소 버튼
- 강좌 일정·장소·강사·준비물 안내
- **QR 체크인 페이지 진입 버튼** — 강좌 당일 활성화
- 출석 현황 (회차 일자별)
- 수료증 발급 시 다운로드 링크
- 취소 버튼 — 환불 정책 안내 표시 후 확정

---

### 7-5. QR 체크인

**페이지 경로:** `/my/offline/[enrollmentId]` 내 모달 또는 별도 페이지

**P0 보안 — QR 토큰:**

- 토큰 생성: `crypto.randomBytes(32).toString('base64url')` — 256-bit entropy. 추측 불가능.
- DB 저장: `offline_session_days.qr_token UNIQUE`. 평문 그대로 OK (해시 X — 검증 시 빠른 조회 필요).
- **노출 차단**: `offline_session_days` RLS 가 `confirmed` 신청자만 SELECT 허용 — public API 로 토큰 유출 차단.
- 활성 윈도우: 시작 시각 ± `offline_qr_window_minutes` (default 30분). 시작 전 미리 활성화 / 종료 후 즉시 비활성화.
- **재사용 가능**: 같은 사용자가 같은 토큰 여러 번 스캔해도 출석 1건만 INSERT (UNIQUE partial index — §3 §12 (c)).

**플로우:**

1. 현장에 비치된 QR 코드 스캔 (QR은 회차 일자별 고유 토큰)
2. 스캔 결과 URL: `/offline/check-in?token={qr_token}`
3. 로그인 확인 → 토큰 검증
4. 검증 통과 조건:
   - `qr_active_from <= now() <= qr_active_until`
   - 해당 사용자가 그 회차에 confirmed 신청자임
5. `offline_attendance` 레코드 생성 (`status = 'present'`, `checked_by = 'self_qr'`)
6. 사이트 알림함에 "출석 완료" 알림 자동 등록

**API 엔드포인트:** `POST /api/offline/attendance/check-in`

---

## 8. API Routes 추가

### 공통 가드

기존 `requireAdmin()`(FEATURE_CMS_HOMEPAGE.md §5 참조) 그대로 재사용.

### 관리자 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/api/admin/offline/programs` | 프로그램 목록/생성 |
| GET/PUT/DELETE | `/api/admin/offline/programs/[id]` | 프로그램 상세/수정/삭제 |
| GET/POST | `/api/admin/offline/sessions` | 회차 목록/생성 |
| GET/PUT/DELETE | `/api/admin/offline/sessions/[id]` | 회차 상세/수정/삭제 |
| GET/POST | `/api/admin/offline/sessions/[id]/days` | 회차 일자 목록/생성 (QR 토큰 자동 발급) |
| PUT/DELETE | `/api/admin/offline/sessions/[id]/days/[dayId]` | 회차 일자 수정/삭제 |
| GET | `/api/admin/offline/enrollments` | 신청 목록 (필터: status, session_id) |
| GET | `/api/admin/offline/enrollments/[id]` | 신청 상세 |
| POST | `/api/admin/offline/enrollments/[id]/confirm-payment` | 입금 확인 (invoice) |
| POST | `/api/admin/offline/enrollments/[id]/cancel` | 관리자 취소 (환불율 자동 계산) |
| POST | `/api/admin/offline/enrollments/[id]/attendees/[attendeeId]/cancel` | 단체 부분 취소 |
| GET | `/api/admin/offline/waitlist` | 대기열 목록 (필터: session_id) |
| POST | `/api/admin/offline/waitlist/[id]/promote` | 수동 승격 |
| GET/PUT | `/api/admin/offline/attendance/[sessionDayId]` | 출석부 조회/일괄 수정 |
| GET | `/api/admin/offline/certificates` | 수료증 발급 내역 |
| POST | `/api/admin/offline/certificates/issue` | 수료증 일괄 발급 (sessionId 기준) |
| GET/PUT | `/api/admin/offline/settings` | 오프라인 설정 조회/저장 |

### 공개/사용자 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/offline/programs` | 공개 프로그램 목록 |
| GET | `/api/offline/programs/[slug]` | 프로그램 상세 + 회차 목록 |
| GET | `/api/offline/sessions/[id]` | 회차 상세 (잔여석 포함) |
| POST | `/api/offline/apply` | 신청 (개인/기업) |
| POST | `/api/offline/checkout` | Stripe Checkout 세션 생성 |
| POST | `/api/offline/webhook` | Stripe Webhook (결제 완료 처리) |
| POST | `/api/offline/waitlist` | 대기열 등록 |
| DELETE | `/api/offline/waitlist/[id]` | 대기열 취소 |
| POST | `/api/offline/attendance/check-in` | QR 체크인 |
| GET | `/api/offline/my` | 내 신청 내역 |
| POST | `/api/offline/my/[enrollmentId]/cancel` | 사용자 자발 취소 |

---

## 9. 자동화 작업 (Cron Jobs)

Vercel Cron(`vercel.json`)으로 등록. 모든 cron 엔드포인트는 `CRON_SECRET` 헤더 검증.

```json
{
  "crons": [
    { "path": "/api/cron/offline/expire-pending-payments",  "schedule": "0 1 * * *" },
    { "path": "/api/cron/offline/send-payment-reminders",   "schedule": "0 9 * * *" },
    { "path": "/api/cron/offline/send-pre-event-notice",    "schedule": "0 9 * * *" },
    { "path": "/api/cron/offline/send-reminders",           "schedule": "0 18 * * *" },
    { "path": "/api/cron/offline/expire-waitlist-grace",    "schedule": "0 * * * *" },
    { "path": "/api/cron/offline/send-pending-notifications","schedule": "*/10 * * * *" }
  ]
}
```

| Cron | 주기 | 동작 |
|------|------|------|
| `expire-pending-payments` | 매일 새벽 1시 | `payment_due_at < now()` 이고 `status = pending_payment`인 건 모두 `expired`로 전이, 알림 발송, 대기열 1순위 자동 승격 |
| `send-payment-reminders` | 매일 오전 9시 | 결제 기한 3일 전·1일 전인 건에 알림 발송 (해당 알림이 아직 미발송인 경우) |
| `send-pre-event-notice` | 매일 오전 9시 | 강좌 시작 `offline_pre_event_notice_days`일 전인 회차의 확정 신청자에게 사전 안내 발송 |
| `send-reminders` | 매일 오후 6시 | 다음 날 시작하는 회차의 확정 신청자에게 리마인더 발송 |
| `expire-waitlist-grace` | 매시간 | 대기열에서 알림 받은 후 기한 초과한 건 `expired` 처리 후 다음 순위 알림 |
| `send-pending-notifications` | 10분마다 | `offline_notifications` 중 `status = pending` 이고 `scheduled_at <= now()` 인 건 실제 발송 |

---

## 10. 알림 시스템

### 발송 채널 3종

- **이메일** — Resend / SendGrid / Supabase 메일 (별도 선정 필요)
- **SMS** — NHN Cloud SMS / Aligo / 카카오 알림톡 (별도 선정 필요)
- **사이트 내 알림함** — `profiles`에 알림 카운트 표시, 헤더에 종 아이콘 + 드롭다운

### 알림 이벤트 매핑

| 이벤트 | type | 트리거 |
|--------|------|--------|
| 신청 접수 | `application_received` | 신청 즉시 |
| 입금 안내 | `payment_instruction` | 세금계산서 결제 선택 시 |
| 결제 기한 3일 전 | `payment_due_3days` | Cron |
| 결제 기한 1일 전 | `payment_due_1day` | Cron |
| 결제 기한 만료 | `payment_expired` | Cron (만료 자동 취소 후) |
| 결제 완료 | `payment_confirmed` | Webhook / 입금 확인 시 |
| 사전 안내 | `pre_event_2weeks` | Cron (강좌 N일 전) |
| 1일 전 리마인더 | `reminder_1day` | Cron |
| 출석 완료 | `attendance_checked_in` | QR 체크인 시 |
| 수료증 발급 | `certificate_issued` | 일괄 발급 시 |
| 만족도 조사 요청 | `survey_request` | 회차 종료 다음날 |
| 대기열 자리 발생 | `waitlist_available` | 자리 발생 시 (취소·환불·만료) |
| 취소/환불 완료 | `cancellation_confirmed` | 취소 처리 시 |
| 강좌 자체 취소 | `session_cancelled` | 관리자 회차 cancel 시 |

### 알림 생성 패턴

```ts
// src/lib/offline/notification-scheduler.ts
export async function scheduleNotification(params: {
  enrollmentId: string
  userId: string
  type: NotificationType
  scheduledAt: Date
  channels?: ('email' | 'sms' | 'in_app')[]
}) {
  await supabase.from('offline_notifications').insert({
    enrollment_id: params.enrollmentId,
    user_id: params.userId,
    type: params.type,
    channels: params.channels ?? ['email', 'sms', 'in_app'],
    scheduled_at: params.scheduledAt,
    status: 'pending',
    subject: renderSubject(params.type, params),
    body: renderBody(params.type, params),
  })
}
```

`send-pending-notifications` cron이 10분마다 `status = pending` AND `scheduled_at <= now()` 건을 가져와 실제 발송 후 `status = sent` 처리.

---

## 11. 환경변수 추가

| 키 | 용도 |
|----|------|
| `RESEND_API_KEY` (또는 SENDGRID_API_KEY) | 이메일 발송 |
| `RESEND_FROM_EMAIL` | 발신 이메일 주소 |
| `SMS_PROVIDER_API_KEY` | SMS 발송 |
| `SMS_SENDER_NUMBER` | 발신 번호 |
| `CRON_SECRET` | Cron 엔드포인트 인증 토큰 |

> Stripe 키(`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`)는 기존 온라인 결제용 키 그대로 재사용. QA 리포트 #3 항목 해결 필요.

---

## 12. 구현 순서 (Phase별 로드맵)

전체 6 Phase로 구성. 각 Phase는 독립적으로 배포 가능한 단위로 잡음.

### Phase 1 — 기반 구조 (1주)

- `supabase/migration_offline.sql` 실행
- 관리자 사이드바에 "오프라인 교육" 그룹 추가
- 프로그램 CRUD (`/admin/offline/programs`)
- 회차 CRUD (`/admin/offline/sessions`)
- 회차 일자 관리 + QR 토큰 자동 발급
- 공개 페이지: 목록(`/offline`) + 상세(`/offline/[slug]`) — 신청 버튼은 비활성

### Phase 2 — 개인 신청 + 카드 결제 (1.5주)

- 신청서 페이지 (`/offline/[slug]/apply/[sessionId]`) — 개인만 우선
- `POST /api/offline/apply` — 신청 생성
- Stripe Checkout 연동 (`/api/offline/checkout`)
- Stripe Webhook (`/api/offline/webhook`) — `confirmed` 전이
- 결제완료 기준 정원/잔여석 계산 로직 (`lib/offline/seat-availability.ts`)
- 마이페이지 신청 내역 (`/my/offline`)
- 신청 접수·결제 완료 알림 (이메일만 우선 — Phase 6에서 SMS·인앱 추가)

### Phase 3 — 기업 단체 + 세금계산서 (1.5주)

- 신청서에 기업 단체 흐름 추가 — 참석자 명단 입력/CSV 업로드
- `offline_attendees` 다건 생성 로직
- 세금계산서 결제 흐름 — 입금 안내 페이지
- 관리자 신청 상세에서 **입금 확인** 처리 (`POST /api/admin/offline/enrollments/[id]/confirm-payment`)
- 결제 기한 만료 cron (`expire-pending-payments`)
- 결제 기한 알림 cron (`send-payment-reminders`)
- 관리자 신청·결제 현황 페이지 (`/admin/offline/enrollments`) — 결제완료/대기/예상 분리 모니터링

### Phase 4 — 대기열 + 환불 (1주)

- 대기열 등록 UI (마감된 회차에 "대기 신청" 버튼)
- `POST /api/offline/waitlist` — 대기열 등록
- 환불 정책 로직 (`lib/offline/refund-policy.ts`)
- 사용자 자발 취소 — 환불율 안내 → 확정
- 관리자 취소 처리
- 단체 신청 부분 취소 (수업 시작 전까지만)
- 자리 발생 시 대기열 1순위 자동 알림
- 대기열 결제 기한 만료 cron (`expire-waitlist-grace`)
- 관리자 대기열 모니터링 (`/admin/offline/waitlist`)

### Phase 5 — 출결 + 수료증 (1주)

- QR 체크인 페이지 + API (`POST /api/offline/attendance/check-in`)
- 관리자 출석부 페이지 (`/admin/offline/attendance/[sessionDayId]`) — 보정 가능
- 출석률 자동 집계
- 수료증 발급 페이지 (`/admin/offline/certificates`) — 수료 가능자 자동 추출
- 수료증 PDF 생성
- 마이페이지에 출석 현황·수료증 다운로드 표시

### Phase 6 — 알림 풀 자동화 (1주)

- SMS 발송 모듈 (`lib/offline/sms.ts`)
- 사이트 내 알림함 UI (헤더 종 아이콘 + 드롭다운)
- 사전 안내 cron (`send-pre-event-notice`)
- 1일 전 리마인더 cron (`send-reminders`)
- 알림 큐 발송 cron (`send-pending-notifications`)
- 모든 알림 이벤트에 3채널 일괄 적용
- 만족도 조사 자동 발송

---

## 부록 — Claude Code 실행 시 참고

### 단일 Phase 작업 시 입력 템플릿

```
@FEATURE_OFFLINE_EDUCATION.md 명세서를 참고해서 Phase {N} 작업을 진행해줘.

작업 범위:
{Phase N의 작업 목록 복사}

지켜야 할 원칙:
- 기존 온라인 강좌 영역 (src/app/courses, src/app/admin/courses 등)은 절대 수정하지 않음
- 새 코드는 모두 src/app/admin/offline/*, src/app/(public)/offline/*, src/app/api/offline/* 하위에 위치
- TypeScript strict mode, ESLint 통과 필수
- Supabase 클라이언트는 기존 `src/lib/supabase/{server,client}` 재사용
- 관리자 API는 모두 `requireAdmin()` 가드 적용
- 가확보(pending_payment)는 정원 카운팅에 영향 주지 않음 — 결제완료(confirmed) 기준으로만 잔여석 계산

먼저 작업 계획을 알려주고, 승인 받으면 진행해줘.
```

### 우선순위 체크리스트

- [ ] Phase 1: DB 마이그레이션 + 관리자 CRUD
- [ ] Phase 2: 개인 신청 + 카드 결제
- [ ] Phase 3: 기업 단체 + 세금계산서 + 가확보 만료 자동화
- [ ] Phase 4: 대기열 + 환불
- [ ] Phase 5: 출결 + 수료증
- [ ] Phase 6: 알림 풀 자동화

---

## 참고 — 기존 자산과의 연관

| 기존 자산 | 연관 방식 |
|---|---|
| `categories` 테이블 | 오프라인 프로그램도 같은 카테고리 사용 |
| `companies` 테이블 | 기업 단체 신청 시 회사 식별 |
| `profiles` 테이블 | 신청자 user_id, 단체 참석자 매칭 |
| `site_settings` 테이블 | 오프라인 글로벌 설정값 (`group_name = 'offline'`) |
| `nav_menus` 테이블 | 헤더에 "오프라인 교육" 메뉴 추가 |
| Stripe 연동 | 기존 온라인 결제 키 그대로 재사용 |
| `requireAdmin()` 가드 | 관리자 API에 동일하게 적용 |
| 기존 `certificates` 테이블 | 건드리지 않음. 오프라인은 `offline_certificates` 별도 운영 |
