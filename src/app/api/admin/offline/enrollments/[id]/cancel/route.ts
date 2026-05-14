import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
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
 * 관리자 취소 — POST /api/admin/offline/enrollments/[id]/cancel
 *
 * 사용자 자발 취소 (/api/offline/cancel) 와 거의 동일한 흐름.
 * 차이점: cancelled_by='admin' / 메일에 cancelledByAdmin=true / 상태 제약 완화
 *   (pending_payment + confirmed 모두 취소 가능)
 *
 * 환불율은 confirmed 만 자동 계산. pending_payment 는 환불 X.
 *
 * body 옵션:
 *   { reason?: string }   // 운영자 메모
 *   { override_refund_amount?: number, override_refund_rate?: 0|50|100 }  // 정책 무시
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { guard, user } = await requireAdmin()
  if (guard) return guard

  const body = await request.json().catch(() => ({})) as {
    reason?: string
    override_refund_amount?: number
    override_refund_rate?: 0 | 50 | 100
  }

  const admin = createAdminClient()

  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, status, applicant_user_id, payment_method, total_amount, vat_included,
      stripe_payment_intent_id, refund_policy_snapshot, session_id,
      company_contact_email, company_contact_name,
      offline_sessions ( title, start_date, end_date,
        offline_programs ( title, slug )
      )
    `)
    .eq('id', params.id)
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
    session_id: string
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
  if (!['pending_payment', 'confirmed'].includes(enrollment.status)) {
    return NextResponse.json(
      { error: `이미 ${enrollment.status} 상태인 신청은 취소할 수 없습니다.` },
      { status: 400 }
    )
  }

  // pending_payment → cancelled (환불 없음)
  if (enrollment.status === 'pending_payment') {
    const { error: updateErr } = await (admin as any)
      .from('offline_enrollments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        notes: body.reason ?? '관리자 취소',
      })
      .eq('id', enrollment.id)
      .eq('status', 'pending_payment')

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    await dispatchEmail(admin, enrollment, 0, 0, true).catch(() => undefined)
    return NextResponse.json({ ok: true, refund_rate: 0, refund_amount: 0 })
  }

  // confirmed → refunded
  // override 가 있으면 우선, 없으면 정책 계산
  const refund = body.override_refund_amount != null && body.override_refund_rate != null
    ? { amount: body.override_refund_amount, rate: body.override_refund_rate }
    : calculateRefund(
        enrollment.total_amount,
        enrollment.offline_sessions!.start_date,
        enrollment.refund_policy_snapshot
      )

  let stripeRefundId: string | null = null
  let stripeError: string | null = null

  if (
    enrollment.payment_method === 'card' &&
    enrollment.stripe_payment_intent_id &&
    refund.amount > 0
  ) {
    try {
      const stripe = getStripeServer()
      const sr = await stripe.refunds.create({
        payment_intent: enrollment.stripe_payment_intent_id,
        amount: refund.amount,
        reason: 'requested_by_customer',
        metadata: {
          enrollment_id: enrollment.id,
          reason: 'admin_cancellation',
          rate: String(refund.rate),
        },
      })
      stripeRefundId = sr.id
    } catch (err) {
      stripeError = err instanceof Error ? err.message : 'Stripe Refund 실패'
      console.error('[admin offline cancel] Stripe Refund failed:', err)
    }
  }

  const refundedAt = new Date().toISOString()
  const noteParts: string[] = ['관리자 취소']
  if (body.reason) noteParts.push(body.reason)
  if (stripeError) noteParts.push(`Stripe Refund 실패: ${stripeError}`)
  else if (enrollment.payment_method === 'invoice' && refund.amount > 0) {
    noteParts.push('세금계산서 결제 — 입금 계좌로 직접 송금 필요.')
  }

  const { data: updateData, error: updateErr } = await (admin as any)
    .from('offline_enrollments')
    .update({
      status: 'refunded',
      cancelled_at: refundedAt,
      cancelled_by: 'admin',
      refunded_at: refundedAt,
      refund_amount: refund.amount,
      refund_rate: refund.rate,
      notes: noteParts.join(' / '),
    })
    .eq('id', enrollment.id)
    .eq('status', 'confirmed')
    .select('id')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  if (!Array.isArray(updateData) || updateData.length === 0) {
    return NextResponse.json({ error: '이미 다른 처리가 진행됐습니다.' }, { status: 409 })
  }

  if (refund.amount > 0) {
    await (admin as any).from('offline_refunds').insert({
      enrollment_id: enrollment.id,
      reason: 'admin_cancellation',
      amount: refund.amount,
      rate: refund.rate,
      processed_by: user!.id,
      processed_by_type: 'admin',
      stripe_refund_id: stripeRefundId,
      notes: stripeError ?? body.reason ?? null,
    })
  }

  await dispatchEmail(admin, enrollment, refund.rate, refund.amount, true).catch(() => undefined)

  // 자리 발생 — 대기열 1순위 자동 승격
  await promoteNextWaitlister(admin, enrollment.session_id).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    refund_rate: refund.rate,
    refund_amount: refund.amount,
    stripe_refund_id: stripeRefundId,
    stripe_error: stripeError,
  })
}

async function dispatchEmail(
  admin: ReturnType<typeof createAdminClient>,
  enrollment: any,
  refundRate: number,
  refundAmount: number,
  cancelledByAdmin: boolean
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
    subject: `[취소] ${programTitle}`,
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
      cancelledByAdmin,
    }),
  })

  await (admin as any).from('offline_notifications').insert({
    enrollment_id: enrollment.id,
    user_id: enrollment.applicant_user_id,
    type: 'cancellation_confirmed',
    channels: ['email'],
    scheduled_at: new Date().toISOString(),
    subject: `[취소] ${programTitle}`,
    status: emailRes.ok ? 'sent' : 'failed',
    email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
    error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
  })
}
