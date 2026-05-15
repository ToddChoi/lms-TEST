import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflinePaymentConfirmedEmail } from '@/lib/email/templates/offline-payment-confirmed'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe Webhook — 오프라인 결제 전용 (/api/offline/webhook).
 * 기존 온라인 강좌 webhook (/api/payments/webhook) 과 분리 — 별도 endpoint 등록 필요.
 *
 * 처리:
 *   checkout.session.completed
 *     - metadata.enrollment_id 가 source of truth
 *     - offline_confirm_enrollment RPC 호출 (FOR UPDATE 락 + 잔여석 재계산 + 상태 전이 원자화)
 *       → result_status: 'confirmed' | 'cancelled' (정원 초과) | 'noop' (이미 처리)
 *     - 'cancelled' 인 경우 Stripe Refund 자동 + offline_refunds 기록
 *   checkout.session.expired / payment_intent.payment_failed
 *     - 그대로 두고 cron (expire-pending-payments) 이 일괄 처리
 *     - notes 만 추가
 *
 * 멱등성:
 *   - offline_enrollments(stripe_session_id) WHERE NOT NULL UNIQUE — 동일 session 재INSERT 차단
 *   - RPC 가 lock 안에서 status guard ('pending_payment' 만 처리) → 동시/재시도 모두 안전
 *   - P1 race fix (2026-05-15): RPC 가 offline_sessions row FOR UPDATE → 동일 session 의
 *     동시 confirm (Stripe webhook + invoice admin) 직렬화. 잔여석 1석에 두 결제가 들어와도
 *     하나만 confirmed, 다른 하나는 cancelled + 자동 환불.
 */
export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  // 오프라인 전용 secret — 별도 endpoint 등록 시 다른 secret. 미설정이면 온라인 키 fallback.
  const secret =
    process.env.STRIPE_OFFLINE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()

  const stripe = getStripeServer()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid'
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const enrollmentId = session.metadata?.enrollment_id
        // 오프라인이 아닌 이벤트는 즉시 무시 (온라인 webhook 으로 가야 함)
        if (!enrollmentId || session.metadata?.offline !== '1') {
          return NextResponse.json({ received: true })
        }

        // payment_intent 추출
        let paymentIntentId: string | null = null
        if (session.payment_intent) {
          paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id
        }

        // total_amount 는 환불 금액 계산용 — RPC 가 enrollment 직접 다루므로 별도 fetch
        const { data: rawAmount } = await admin
          .from('offline_enrollments')
          .select('total_amount')
          .eq('id', enrollmentId)
          .maybeSingle()
        const totalAmount = (rawAmount as unknown as { total_amount: number } | null)?.total_amount ?? 0

        // P1 race fix — offline_confirm_enrollment RPC 호출 (FOR UPDATE 락 + 원자 전이).
        // 결과: 'confirmed' / 'cancelled' (정원 초과) / 'noop' (이미 처리됨 / enrollment 없음)
        const { data: rpcRows, error: rpcErr } = await (admin as any).rpc(
          'offline_confirm_enrollment',
          {
            p_enrollment_id: enrollmentId,
            p_paid_at: new Date().toISOString(),
            p_stripe_payment_intent_id: paymentIntentId,
            p_invoice_confirmed_by: null,  // Stripe 경로
          }
        )
        if (rpcErr) {
          console.error('[offline webhook] confirm RPC failed:', rpcErr)
          throw rpcErr
        }

        const result = (rpcRows as Array<{
          result_status: 'confirmed' | 'cancelled' | 'noop'
          available_seats: number
          attendee_count: number
          message: string
        }>)?.[0]

        if (!result || result.result_status === 'noop') {
          return NextResponse.json({ received: true, idempotent: true, reason: result?.message })
        }

        if (result.result_status === 'cancelled') {
          // 정원 초과 — 자동 환불 + offline_refunds 기록 + 감사 로그
          let refundId: string | null = null
          let refundError: string | null = null
          if (paymentIntentId) {
            try {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: 'requested_by_customer',
                metadata: { enrollment_id: enrollmentId, reason: 'capacity_exceeded' },
              })
              refundId = refund.id
            } catch (err) {
              refundError = err instanceof Error ? err.message : 'refund failed'
              console.error('[offline webhook] auto refund failed:', err)
            }
          }

          // RPC 가 이미 cancelled 전이 + notes 기록 — 환불 결과만 추가 notes 로 append.
          if (refundError) {
            await (admin as any)
              .from('offline_enrollments')
              .update({ notes: `정원 초과 cancelled, Stripe 환불 실패 (수동 처리 필요): ${refundError}` })
              .eq('id', enrollmentId)
          }

          // offline_refunds 기록 (자동)
          if (refundId) {
            await (admin as any).from('offline_refunds').insert({
              enrollment_id: enrollmentId,
              reason: 'system_expired',
              amount: totalAmount,
              rate: 100,
              processed_by_type: 'system',
              stripe_refund_id: refundId,
              notes: '정원 초과 자동 환불 (RPC 원자 전이 후)',
            })
          }

          // 감사 로그
          await (admin as any).from('offline_audit_log').insert({
            entity_type: 'enrollment',
            entity_id: enrollmentId,
            action: 'capacity_exceeded_refund',
            actor_type: 'system',
            diff: {
              available: result.available_seats,
              requested: result.attendee_count,
              refund_id: refundId,
              refund_error: refundError,
            },
          })

          break
        }

        // result.result_status === 'confirmed' — 메일 발송 (RPC 가 이미 status 전이)
        await dispatchPaymentConfirmedEmail(admin, enrollmentId).catch((e) => {
          console.warn('[offline webhook] payment_confirmed email failed:', e)
        })
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const enrollmentId = session.metadata?.enrollment_id
        if (!enrollmentId || session.metadata?.offline !== '1') {
          return NextResponse.json({ received: true })
        }
        // 즉시 expired 전이는 안 함 — expire-pending-payments cron 이 payment_due_at 기준으로 일괄 처리.
        // 단, Stripe 가 명시적으로 expired 알렸으니 notes 추가.
        await (admin as any)
          .from('offline_enrollments')
          .update({ notes: 'Stripe Checkout 세션 만료 — payment_due_at 까지 재시도 가능 또는 cron 만료 처리.' })
          .eq('id', enrollmentId)
          .eq('status', 'pending_payment')
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const enrollmentId = pi.metadata?.enrollment_id
        if (!enrollmentId) {
          // payment_intent 가 직접 enrollment 와 매핑된 metadata 없음 — fallback 으로
          // stripe_payment_intent_id 매칭 시도 (드물지만 안전망)
          if (pi.id) {
            await (admin as any)
              .from('offline_enrollments')
              .update({ notes: '카드 결제 실패 (payment_intent)' })
              .eq('stripe_payment_intent_id', pi.id)
              .eq('status', 'pending_payment')
          }
          break
        }
        await (admin as any)
          .from('offline_enrollments')
          .update({ notes: '카드 결제 실패' })
          .eq('id', enrollmentId)
          .eq('status', 'pending_payment')
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error'
    console.error('[offline webhook] handler error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * 결제 완료 이메일 발송 + offline_notifications 기록 (자리 확정 알림).
 * webhook 의 confirmed 전이가 실제로 발생한 row 에만 호출 (멱등 보장).
 */
async function dispatchPaymentConfirmedEmail(
  admin: ReturnType<typeof createAdminClient>,
  enrollmentId: string
) {
  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, applicant_user_id,
      offline_sessions (
        title, start_date, end_date, location_name, location_address,
        offline_programs ( title )
      )
    `)
    .eq('id', enrollmentId)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as {
    id: string
    applicant_user_id: string
    offline_sessions: {
      title: string | null
      start_date: string
      end_date: string
      location_name: string | null
      location_address: string | null
      offline_programs: { title: string } | null
    } | null
  } | null
  if (!enrollment || !enrollment.offline_sessions) return

  const { data: rawProfile } = await admin
    .from('profiles')
    .select('email, name')
    .eq('id', enrollment.applicant_user_id)
    .maybeSingle()
  const profile = rawProfile as unknown as { email: string | null; name: string | null } | null
  if (!profile?.email) return

  const sess = enrollment.offline_sessions
  const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
  const sessionPeriod =
    sess.start_date === sess.end_date
      ? formatDate(sess.start_date)
      : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

  const emailRes = await sendEmail({
    to: profile.email,
    subject: `[자리 확정] ${programTitle}`,
    template: 'offline-payment-confirmed',
    userId: enrollment.applicant_user_id,
    react: OfflinePaymentConfirmedEmail({
      name: profile.name,
      programTitle,
      sessionLabel: sess.title ?? '',
      sessionPeriod,
      locationName: sess.location_name,
      locationAddress: sess.location_address,
      enrollmentId,
    }),
  })

  await (admin as any).from('offline_notifications').insert({
    enrollment_id: enrollmentId,
    user_id: enrollment.applicant_user_id,
    type: 'payment_confirmed',
    channels: ['email'],
    scheduled_at: new Date().toISOString(),
    subject: `[자리 확정] ${programTitle}`,
    status: emailRes.ok ? 'sent' : 'failed',
    email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
    error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
  })
}
