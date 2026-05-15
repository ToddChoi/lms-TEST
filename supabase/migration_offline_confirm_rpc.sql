-- =====================================================
-- offline_confirm_enrollment — P1 좌석 race condition 해소
-- =====================================================
-- 배경:
--   기존 webhook + invoice admin 양쪽이 다음 패턴:
--     1) offline_session_available_seats() 조회 (STABLE — 락 없음)
--     2) UPDATE enrollments SET status='confirmed' WHERE status='pending_payment'
--   동시 결제 2건 → 둘 다 available=N 보고 → 둘 다 confirmed → 정원 초과.
--
-- 해결:
--   본 RPC 가 한 트랜잭션에서:
--     1) offline_sessions row FOR UPDATE (직렬화)
--     2) enrollment status 재검증 (이미 처리됐으면 noop)
--     3) 잔여석 계산 (lock 안에서 — 다른 트랜잭션의 동시 confirmed 차단)
--     4) 가능 → confirmed / 불가능 → cancelled 즉시 전이
--   webhook + invoice admin 양쪽 동일 RPC 사용 → 단일 진실 공급원.
--
-- 시그니처:
--   p_enrollment_id              : 처리할 enrollment
--   p_paid_at                    : 결제 완료 시각 (Stripe webhook 의 session.completed 시각 / 관리자 입금 확인 시각)
--   p_stripe_payment_intent_id   : Stripe payment_intent (invoice 시 NULL)
--   p_invoice_confirmed_by       : 입금 확인한 admin user_id (Stripe 시 NULL)
--
-- 반환 컬럼 (TABLE):
--   result_status   : 'confirmed' | 'cancelled' | 'noop'
--   available_seats : 처리 시점 잔여석 (capacity - confirmed)
--   attendee_count  : 이 enrollment 의 좌석 수 (개인 1 / 단체 N)
--   message         : 디버그 / 사용자 표시용
--
-- 적용:
--   Supabase Dashboard > SQL Editor 에서 실행. 멱등 (CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION offline_confirm_enrollment(
  p_enrollment_id            UUID,
  p_paid_at                  TIMESTAMPTZ,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_invoice_confirmed_by     UUID DEFAULT NULL
)
RETURNS TABLE (
  result_status   TEXT,
  available_seats INT,
  attendee_count  INT,
  message         TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enrollment       offline_enrollments%ROWTYPE;
  v_session_capacity INT;
  v_confirmed_seats  INT;
  v_available        INT;
  v_actor            TEXT;
BEGIN
  -- 1) enrollment 1차 fetch (lock 잡을 session_id 확보)
  SELECT * INTO v_enrollment
    FROM offline_enrollments
    WHERE id = p_enrollment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'noop'::TEXT, 0, 0, ('enrollment not found: ' || p_enrollment_id::TEXT);
    RETURN;
  END IF;

  -- 2) session row lock — 직렬화 핵심.
  --    동일 session 의 다른 confirm 트랜잭션은 이 PERFORM 에서 대기.
  PERFORM 1 FROM offline_sessions
    WHERE id = v_enrollment.session_id AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'noop'::TEXT, 0, v_enrollment.attendee_count, 'session not found or deleted';
    RETURN;
  END IF;

  -- 3) lock 안에서 enrollment 재검증 (다른 트랜잭션이 cancelled / confirmed 변경했을 수 있음)
  SELECT * INTO v_enrollment
    FROM offline_enrollments
    WHERE id = p_enrollment_id;

  IF v_enrollment.status <> 'pending_payment' THEN
    RETURN QUERY SELECT 'noop'::TEXT, 0, v_enrollment.attendee_count,
      ('already ' || v_enrollment.status);
    RETURN;
  END IF;

  -- 4) 잔여석 계산 (lock 잡힌 상태). offline_session_available_seats 와 동일 로직.
  SELECT s.capacity INTO v_session_capacity
    FROM offline_sessions s
    WHERE s.id = v_enrollment.session_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN e.applicant_type = 'individual' THEN 1
      WHEN e.applicant_type = 'corporate'  THEN (
        SELECT COUNT(*)::INT FROM offline_attendees a
        WHERE a.enrollment_id = e.id AND a.cancelled_at IS NULL
      )
    END
  ), 0)::INT INTO v_confirmed_seats
  FROM offline_enrollments e
  WHERE e.session_id = v_enrollment.session_id
    AND e.status = 'confirmed'
    AND e.deleted_at IS NULL;

  v_available := v_session_capacity - v_confirmed_seats;
  v_actor := CASE WHEN p_invoice_confirmed_by IS NOT NULL THEN 'admin' ELSE 'system_expired' END;

  -- 5) 분기 — 정원 초과 시 cancelled, 그 외 confirmed
  IF v_available < v_enrollment.attendee_count THEN
    UPDATE offline_enrollments
       SET status                   = 'cancelled',
           cancelled_at             = NOW(),
           cancelled_by             = v_actor,
           stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
           notes                    = COALESCE(notes || E'\n', '') ||
                                       '정원 초과 — 자동 취소 (잔여 ' || v_available
                                       || ', 요청 ' || v_enrollment.attendee_count || ')'
     WHERE id = p_enrollment_id
       AND status = 'pending_payment';

    RETURN QUERY SELECT 'cancelled'::TEXT, v_available, v_enrollment.attendee_count,
      ('정원 초과 — 자동 취소 (잔여 ' || v_available
       || ', 요청 ' || v_enrollment.attendee_count || ')');
    RETURN;
  END IF;

  -- 6) 정상 confirmed 전이
  UPDATE offline_enrollments
     SET status                    = 'confirmed',
         paid_at                   = p_paid_at,
         stripe_payment_intent_id  = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
         invoice_paid_confirmed_at = CASE WHEN p_invoice_confirmed_by IS NOT NULL THEN NOW()
                                          ELSE invoice_paid_confirmed_at END,
         invoice_paid_confirmed_by = COALESCE(p_invoice_confirmed_by, invoice_paid_confirmed_by)
   WHERE id = p_enrollment_id
     AND status = 'pending_payment';

  RETURN QUERY SELECT 'confirmed'::TEXT, v_available, v_enrollment.attendee_count, 'OK'::TEXT;
END;
$$;

-- 호출 권한: anon 은 호출 불가 (SECURITY DEFINER 라도 GRANT 명시 안 하면 EXECUTE 불가).
-- service_role 만 호출 가능 — webhook + admin route 모두 createAdminClient 사용.
REVOKE ALL ON FUNCTION offline_confirm_enrollment(UUID, TIMESTAMPTZ, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION offline_confirm_enrollment(UUID, TIMESTAMPTZ, TEXT, UUID) TO service_role;
