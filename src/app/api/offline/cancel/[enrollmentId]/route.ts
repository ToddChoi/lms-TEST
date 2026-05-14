import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe'
import { sendEmail } from '@/lib/email/send'
import { OfflineCancellationConfirmedEmail } from '@/lib/email/templates/offline-cancellation-confirmed'
import { calculateRefund, type RefundPolicy } from '@/lib/offline/refund-policy'
import { promoteNextWaitlister } from '@/lib/offline/waitlist-promote'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 사용자 자발 취소 — POST /api/offline/cancel/[enrollmentId]
 *
 * 동작:
 *   1. 본인 enrollment 검증 (applicant_user_id = auth user)
 *   2. 상태별 분기:
 *      - pending_payment: 즉시 cancelled (환불 X)
 *      - confirmed: 환불 정책 계산 → Stripe Refund (card 만 자동) → refunded
 *      - expired/cancelled/refunded: 이미 종료 상태 → 400
 *   3. card 환불: stripe.refunds.create + offline_refunds INSERT
 *   4. invoice 환불: 운영자 수동 처리 — notes 표시 + offline_refunds 는
 *      운영자가 admin UI 에서 INSERT (Phase 4 후속)
 *   5. cancellation_confirmed 메일 + offline_notifications
 *
 * 멱등: status guard ('pending_payment' 또는 'confirmed' 만 처리).
 */
export async function POST(
  request: Request,
  { params }: { params: { enrollmentId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // enrollment + 회차 + 정책 fetch
  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, status, applicant_user_id, payment_method, total_amount, vat_included,
      stripe_payment_intent_id, refund_policy_snapshot, paid_at,
      company_contact_email, company_contact_name,
      offline_sessions ( title, start_date, end_date,
        offline_programs ( title, slug )
      )
    `)
    .eq('id', params.enrollmentId)
    .is('deleted_at', null)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as {
    id: string
    status: string
    applicant_user_id: string
    payment_method: 'card' | 'invoice' | null
    total_amount: number
    vat_included: boolean
    stripe_payment_intent_id: string | null
    refund_policy_snapshot: RefundPolicy
    paid_at: string | null
    company_contact_email: string | null
    company_contact_name: string | null
    offline_sessions: {
      title: string | null
      start_date: string
      end_date: string
      offline_programs: { title: string; slug: string } | null
    } | null
  } | null

  if (!enrollment) {
    return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (enrollment.applicant_user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  if (!['pending_payment', 'confirmed'].includes(enrollment.status)) {
    return NextResponse.json(
      { error: `이미 ${enrollment.status} 상태인 신청은 취소할 수 없습니다.` },
      { status: 400 }
    )
  }
  if (!enrollment.offline_sessions) {
    return NextResponse.json({ error: '회차 정보가 없습니다.' }, { status: 500 })
  }

  // ─── pending_payment: 즉시 cancelled (환불 없음) ────────
  if (enrollment.status === 'pending_payment') {
    const { error: updateErr } = await (admin as any)
      .from('offline_enrollments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'user',
      })
      .eq('id', enrollment.id)
      .eq('status', 'pending_payment')  // race-safe

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // pending 취소는 confirmed 가 아니라 정원에 영향 없음 (자리 차감 안 했었음).
    // → 대기열 승격 X.

    // 메일은 발송하지만 환불 0%
    await dispatchCancellationEmail(admin, enrollment, 0, 0).catch(() => undefined)

    return NextResponse.json({ ok: true, refund_rate: 0, refund_amount: 0 })
  }

  // ─── confirmed: 환불율 계산 후 refunded 전이 ────────────
  const refund = calculateRefund(
    enrollment.total_amount,
    enrollment.offline_sessions.start_date,
    enrollment.refund_policy_snapshot
  )

  let stripeRefundId: string | null = null
  let stripeError: string | null = null

  // card + 환불액 > 0 → Stripe Refund 자동
  if (
    enrollment.payment_method === 'card' &&
    enrollment.stripe_payment_intent_id &&
    refund.amount > 0
  ) {
    try {
      const stripe = getStripeServer()
      const stripeRefund = await stripe.refunds.create({
        payment_intent: enrollment.stripe_payment_intent_id,
        amount: refund.amount,
        reason: 'requested_by_customer',
        metadata: {
          enrollment_id: enrollment.id,
          reason: 'user_cancellation',
          rate: String(refund.rate),
        },
      })
      stripeRefundId = stripeRefund.id
    } catch (err) {
      stripeError = err instanceof Error ? err.message : 'Stripe Refund 실패'
      console.error('[offline cancel] Stripe Refund failed:', err)
      // 환불 실패해도 enrollment 는 취소 처리 (운영자 수동 환불)
    }
  }

  // confirmed → refunded 전이 (트리거 허용)
  const refundedAt = new Date().toISOString()
  const { error: updateErr, data: updateData } = await (admin as any)
    .from('offline_enrollments')
    .update({
      status: 'refunded',
      cancelled_at: refundedAt,
      cancelled_by: 'user',
      refunded_at: refundedAt,
      refund_amount: refund.amount,
      refund_rate: refund.rate,
      notes: stripeError
        ? `사용자 자발 취소. Stripe Refund 실패 — 운영자 수동 환불 필요: ${stripeError}`
        : enrollment.payment_method === 'invoice' && refund.amount > 0
        ? '사용자 자발 취소. 세금계산서 결제 — 운영자가 입금 계좌로 직접 송금 필요.'
        : undefined,
    })
    .eq('id', enrollment.id)
    .eq('status', 'confirmed')  // race-safe
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }
  if (!Array.isArray(updateData) || updateData.length === 0) {
    return NextResponse.json(
      { error: '이미 다른 처리가 진행됐습니다.' },
      { status: 409 }
    )
  }

  // offline_refunds 기록
  if (refund.amount > 0) {
    await (admin as any).from('offline_refunds').insert({
      enrollment_id: enrollment.id,
      reason: 'user_cancellation',
      amount: refund.amount,
      rate: refund.rate,
      processed_by: user.id,
      processed_by_type: 'user',
      stripe_refund_id: stripeRefundId,
      notes: stripeError ?? undefined,
    })
  }

  // cancellation_confirmed 메일
  await dispatchCancellationEmail(admin, enrollment, refund.rate, refund.amount).catch(() => undefined)

  // 자리 발생 — 대기열 1순위 자동 승격 (best-effort, 실패해도 취소는 유지)
  if (enrollment.offline_sessions) {
    const sessionId = (
      await admin
        .from('offline_enrollments')
        .select('session_id')
        .eq('id', enrollment.id)
        .maybeSingle()
    ).data as unknown as { session_id: string } | null
    if (sessionId) {
      await promoteNextWaitlister(admin, sessionId.session_id).catch(() => undefined)
    }
  }

  return NextResponse.json({
    ok: true,
    refund_rate: refund.rate,
    refund_amount: refund.amount,
    stripe_refund_id: stripeRefundId,
    stripe_error: stripeError,
  })
}

async function dispatchCancellationEmail(
  admin: ReturnType<typeof createAdminClient>,
  enrollment: any,
  refundRate: number,
  refundAmount: number
) {
  const sess = enrollment.offline_sessions
  if (!sess) return

  const { data: profile } = await admin
    .from('profiles').select('email, name').eq('id', enrollment.applicant_user_id).maybeSingle()
  const recipientEmail = enrollment.company_contact_email ?? (profile as any)?.email
  const recipientName = enrollment.company_contact_name ?? (profile as any)?.name
  if (!recipientEmail) return

  const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
  const sessionPeriod =
    sess.start_date === sess.end_date
      ? formatDate(sess.start_date)
      : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

  const emailRes = await sendEmail({
    to: recipientEmail,
    subject: `[취소 완료] ${programTitle}`,
    template: 'offline-cancellation-confirmed',
    userId: enrollment.applicant_user_id,
    react: OfflineCancellationConfirmedEmail({
      name: recipientName,
      programTitle,
      sessionLabel: sess.title ?? '',
      sessionPeriod,
      refundAmount,
      refundRate: refundRate as 0 | 50 | 100,
      paymentMethod: enrollment.payment_method,
    }),
  })

  await (admin as any).from('offline_notifications').insert({
    enrollment_id: enrollment.id,
    user_id: enrollment.applicant_user_id,
    type: 'cancellation_confirmed',
    channels: ['email'],
    scheduled_at: new Date().toISOString(),
    subject: `[취소 완료] ${programTitle}`,
    status: emailRes.ok ? 'sent' : 'failed',
    email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
    error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
  })
}
