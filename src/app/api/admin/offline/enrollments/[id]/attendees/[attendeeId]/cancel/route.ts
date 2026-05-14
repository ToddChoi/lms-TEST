import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe'
import dayjs from '@/lib/dayjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 단체 신청 부분 취소 — POST /api/admin/offline/enrollments/[id]/attendees/[attendeeId]/cancel
 *
 * 동작:
 *   1. 강좌 시작 전 검증 (offline_sessions.start_date > today KST)
 *   2. attendee.cancelled_at = now
 *      - sync_enrollment_attendee_count 트리거가 enrollment.attendee_count 자동 감소
 *   3. 1인분 환불액 = unit_price (정책 무시 — 부분 취소는 즉시 환불)
 *      또는 calculateRefund 적용 후 1인 비율 — 운영 정책 결정 사항.
 *      현재 구현: calculateRefund(unit_price, ...) 적용 — 강좌 임박이면 환불 0.
 *   4. card 자동 환불 / invoice 운영자 수동
 *   5. offline_refunds INSERT (reason='attendee_partial', attendee_id 명시)
 *      sync_enrollment_refund_total 트리거가 enrollment.refund_amount 누적.
 *
 * 강좌 시작 후엔 부분 취소 불가 (PRD §6-3 — 시작 전까지만).
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string; attendeeId: string } }
) {
  const { guard, user } = await requireAdmin()
  if (guard) return guard

  const admin = createAdminClient()

  // 참석자 + enrollment + 회차 fetch
  const { data: rawAttendee } = await (admin as any)
    .from('offline_attendees')
    .select(`
      id, name, cancelled_at, enrollment_id,
      offline_enrollments!inner (
        id, status, payment_method, unit_price, vat_included,
        stripe_payment_intent_id, refund_policy_snapshot, session_id,
        offline_sessions ( start_date )
      )
    `)
    .eq('id', params.attendeeId)
    .eq('enrollment_id', params.id)
    .maybeSingle()

  const attendee = rawAttendee as unknown as {
    id: string
    name: string
    cancelled_at: string | null
    enrollment_id: string
    offline_enrollments: {
      id: string
      status: string
      payment_method: 'card' | 'invoice' | null
      unit_price: number
      vat_included: boolean
      stripe_payment_intent_id: string | null
      refund_policy_snapshot: { full_refund_days_before: number; half_refund_days_before: number }
      session_id: string
      offline_sessions: { start_date: string } | null
    } | null
  } | null

  if (!attendee || !attendee.offline_enrollments) {
    return NextResponse.json({ error: '참석자를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (attendee.cancelled_at) {
    return NextResponse.json({ error: '이미 취소된 참석자입니다.' }, { status: 400 })
  }
  if (!['confirmed', 'pending_payment'].includes(attendee.offline_enrollments.status)) {
    return NextResponse.json(
      { error: `enrollment 상태가 ${attendee.offline_enrollments.status} 라 부분 취소 불가.` },
      { status: 400 }
    )
  }

  const enrollment = attendee.offline_enrollments

  // 강좌 시작 전 검증
  const startDate = enrollment.offline_sessions?.start_date
  if (!startDate) {
    return NextResponse.json({ error: '회차 시작일 정보 없음.' }, { status: 500 })
  }
  const startMs = dayjs(startDate).startOf('day').valueOf()
  const todayMs = dayjs().startOf('day').valueOf()
  if (startMs <= todayMs) {
    return NextResponse.json(
      { error: '강좌 시작 후에는 부분 취소가 불가능합니다.' },
      { status: 400 }
    )
  }

  // 환불액 계산 — 단순화: 1인분 unit_price 의 환불 정책 비율
  // 강좌 시작일 기준 days 계산 (refund-policy 와 동일)
  const days = dayjs(startDate).startOf('day').diff(dayjs().startOf('day'), 'day')
  const policy = enrollment.refund_policy_snapshot
  let rate: 0 | 50 | 100 = 0
  if (days >= policy.full_refund_days_before) rate = 100
  else if (days >= policy.half_refund_days_before) rate = 50
  const refundAmount = Math.floor((enrollment.unit_price * rate) / 100)

  let stripeRefundId: string | null = null
  let stripeError: string | null = null

  // confirmed + card + 환불액 > 0 → Stripe Refund (부분)
  if (
    enrollment.status === 'confirmed' &&
    enrollment.payment_method === 'card' &&
    enrollment.stripe_payment_intent_id &&
    refundAmount > 0
  ) {
    try {
      const stripe = getStripeServer()
      const sr = await stripe.refunds.create({
        payment_intent: enrollment.stripe_payment_intent_id,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          enrollment_id: enrollment.id,
          attendee_id: attendee.id,
          reason: 'attendee_partial',
          rate: String(rate),
        },
      })
      stripeRefundId = sr.id
    } catch (err) {
      stripeError = err instanceof Error ? err.message : 'Stripe Refund 실패'
      console.error('[admin attendee cancel] Stripe Refund failed:', err)
    }
  }

  // attendee.cancelled_at → sync 트리거 자동
  const { error: updateErr } = await (admin as any)
    .from('offline_attendees')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', attendee.id)
    .is('cancelled_at', null)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 환불 row INSERT (refund_amount > 0 또는 confirmed 였을 때만)
  if (enrollment.status === 'confirmed' && refundAmount > 0) {
    await (admin as any).from('offline_refunds').insert({
      enrollment_id: enrollment.id,
      attendee_id: attendee.id,
      reason: 'attendee_partial',
      amount: refundAmount,
      rate,
      processed_by: user!.id,
      processed_by_type: 'admin',
      stripe_refund_id: stripeRefundId,
      notes: stripeError ?? `부분 취소: ${attendee.name}`,
    })
  }

  // 자리 발생 — 대기열 승격
  await promoteIfPossible(admin, enrollment.session_id).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    refund_rate: rate,
    refund_amount: refundAmount,
    stripe_refund_id: stripeRefundId,
    stripe_error: stripeError,
  })
}

async function promoteIfPossible(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  const { promoteNextWaitlister } = await import('@/lib/offline/waitlist-promote')
  await promoteNextWaitlister(admin, sessionId)
}
