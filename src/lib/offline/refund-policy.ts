/**
 * 환불율 계산 (오프라인 신청).
 *
 * 정책:
 *   - 시작일 D 일 전까지 100% 환불 (default 7일)
 *   - 시작일 H 일 전까지 50% 환불 (default 3일)
 *   - 그 외 (시작 임박 ~ 시작 후) 0% 환불
 *
 * 정책 자체는 회차 단위로 신청 시점에 enrollment 의 refund_policy_snapshot
 * 으로 박힘 — 운영자가 정책을 변경해도 기존 신청자에게 소급 적용 X.
 *
 * 시간 비교: KST (Asia/Seoul) 자정 기준. 신청자가 "오늘 신청한 강좌가
 * 7일 후 시작" 일 때 정확히 100% 환불 가능하도록.
 */

export interface RefundPolicy {
  full_refund_days_before: number
  half_refund_days_before: number
}

export interface RefundCalculation {
  rate: 0 | 50 | 100
  amount: number
  reason: 'full_refund_window' | 'half_refund_window' | 'no_refund_window'
}

/**
 * KST 기준 자정으로 정규화된 Date.
 */
function kstMidnight(date: Date): Date {
  // KST = UTC+9
  // 입력 Date 의 KST 자정을 UTC 로 변환
  const utcMs = date.getTime()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstMs = utcMs + kstOffsetMs
  // KST 기준 자정으로 floor
  const kstMidnightMs = Math.floor(kstMs / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000)
  // 다시 UTC 로
  return new Date(kstMidnightMs - kstOffsetMs)
}

/**
 * 두 날짜 사이의 일수 (KST 자정 기준).
 *   sessionStart - now (양수면 미래).
 */
export function daysUntil(sessionStartDate: string | Date, now: Date = new Date()): number {
  const start = typeof sessionStartDate === 'string'
    ? kstMidnight(new Date(sessionStartDate + (sessionStartDate.length === 10 ? 'T00:00:00+09:00' : '')))
    : kstMidnight(sessionStartDate)
  const today = kstMidnight(now)
  return Math.round((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * 환불율 + 금액 계산.
 *
 * @param totalAmount enrollment.total_amount (원 단위 정수)
 * @param sessionStartDate offline_sessions.start_date (YYYY-MM-DD)
 * @param policy enrollment.refund_policy_snapshot
 * @param now 현재 시각 (테스트 주입용)
 */
export function calculateRefund(
  totalAmount: number,
  sessionStartDate: string | Date,
  policy: RefundPolicy,
  now: Date = new Date()
): RefundCalculation {
  const days = daysUntil(sessionStartDate, now)

  if (days >= policy.full_refund_days_before) {
    return {
      rate: 100,
      amount: totalAmount,
      reason: 'full_refund_window',
    }
  }
  if (days >= policy.half_refund_days_before) {
    return {
      rate: 50,
      amount: Math.floor(totalAmount * 0.5),
      reason: 'half_refund_window',
    }
  }
  return {
    rate: 0,
    amount: 0,
    reason: 'no_refund_window',
  }
}
