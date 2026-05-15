import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflinePaymentConfirmedEmail } from '@/lib/email/templates/offline-payment-confirmed'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 세금계산서 결제 — 관리자 입금 확인 처리.
 *
 * 동작:
 *   1. 본인 admin/superadmin 검증
 *   2. enrollment 의 payment_method='invoice' / status='pending_payment' / soft-deleted X 검증
 *   3. offline_confirm_enrollment RPC 호출 (FOR UPDATE 락 + 잔여석 재계산 + 상태 전이 원자화)
 *      - 'confirmed' : payment_confirmed 메일 + offline_notifications INSERT
 *      - 'cancelled' : 정원 초과 자동 취소 — 운영자 수동 환불 안내 (오프라인 환불)
 *      - 'noop'      : 이미 처리됨 — 새로고침 안내
 *
 * 멱등 / race-safe:
 *   - P1 race fix (2026-05-15): RPC 가 offline_sessions row FOR UPDATE → Stripe webhook 과
 *     동일 session 의 동시 confirm 직렬화. 잔여석 1석에 두 confirm 들어와도 정확히 하나만 성공.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { guard, user, role } = await requireAdmin()
  if (guard) return guard

  const admin = createAdminClient()

  // 사전 검증용 fetch (status / payment_method / 메일 발송용 메타).
  // 실제 status 전이는 RPC 안에서 lock + 재검증 → race-safe.
  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, status, payment_method, applicant_user_id, session_id, attendee_count,
      offline_sessions (
        title, start_date, end_date, location_name, location_address,
        offline_programs ( title )
      )
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as {
    id: string
    status: string
    payment_method: 'card' | 'invoice' | null
    applicant_user_id: string
    session_id: string
    attendee_count: number
    offline_sessions: {
      title: string | null
      start_date: string
      end_date: string
      location_name: string | null
      location_address: string | null
      offline_programs: { title: string } | null
    } | null
  } | null

  if (!enrollment) {
    return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (enrollment.payment_method !== 'invoice') {
    return NextResponse.json(
      { error: '세금계산서 결제 신청만 입금 확인 가능합니다.' },
      { status: 400 }
    )
  }
  if (enrollment.status !== 'pending_payment') {
    return NextResponse.json(
      { error: `이미 ${enrollment.status} 상태입니다.` },
      { status: 400 }
    )
  }

  // P1 race fix — RPC 호출. lock 안에서 잔여석 재계산 + 상태 전이.
  const { data: rpcRows, error: rpcErr } = await (admin as any).rpc(
    'offline_confirm_enrollment',
    {
      p_enrollment_id: enrollment.id,
      p_paid_at: new Date().toISOString(),
      p_stripe_payment_intent_id: null,  // invoice 경로
      p_invoice_confirmed_by: user!.id,
    }
  )
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  const result = (rpcRows as Array<{
    result_status: 'confirmed' | 'cancelled' | 'noop'
    available_seats: number
    attendee_count: number
    message: string
  }>)?.[0]

  if (!result || result.result_status === 'noop') {
    return NextResponse.json(
      { error: result?.message ?? '이미 다른 처리가 진행됐습니다. 새로고침 후 확인해주세요.' },
      { status: 409 }
    )
  }

  if (result.result_status === 'cancelled') {
    // RPC 가 이미 cancelled 전이 + notes — 감사 로그만 추가
    await (admin as any).from('offline_audit_log').insert({
      entity_type: 'enrollment',
      entity_id: enrollment.id,
      action: 'capacity_exceeded_at_confirm',
      actor_user_id: user!.id,
      actor_type: 'admin',
      diff: { available: result.available_seats, requested: result.attendee_count },
    })
    return NextResponse.json(
      {
        ok: false,
        error: `정원 초과로 자동 취소되었습니다. (잔여 ${result.available_seats}석, 요청 ${result.attendee_count}명) 환불 처리가 필요합니다.`,
      },
      { status: 409 }
    )
  }
  // result.result_status === 'confirmed' — 아래 메일 발송 흐름 진행

  // payment_confirmed 메일 — best effort
  try {
    // 단체면 담당자 이메일, 개인이면 본인 이메일
    const { data: rawProfile } = await admin
      .from('profiles').select('email, name').eq('id', enrollment.applicant_user_id).maybeSingle()
    const profile = rawProfile as unknown as { email: string | null; name: string | null } | null

    const { data: rawCorp } = await admin
      .from('offline_enrollments')
      .select('company_contact_name, company_contact_email')
      .eq('id', enrollment.id)
      .maybeSingle()
    const corp = rawCorp as unknown as {
      company_contact_name: string | null
      company_contact_email: string | null
    } | null

    const recipientEmail = corp?.company_contact_email ?? profile?.email
    const recipientName = corp?.company_contact_name ?? profile?.name

    if (recipientEmail && enrollment.offline_sessions) {
      const sess = enrollment.offline_sessions
      const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
      const sessionPeriod =
        sess.start_date === sess.end_date
          ? formatDate(sess.start_date)
          : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

      const emailRes = await sendEmail({
        to: recipientEmail,
        subject: `[자리 확정] ${programTitle}`,
        template: 'offline-payment-confirmed',
        userId: enrollment.applicant_user_id,
        react: OfflinePaymentConfirmedEmail({
          name: recipientName,
          programTitle,
          sessionLabel: sess.title ?? '',
          sessionPeriod,
          locationName: sess.location_name,
          locationAddress: sess.location_address,
          enrollmentId: enrollment.id,
        }),
      })

      await (admin as any).from('offline_notifications').insert({
        enrollment_id: enrollment.id,
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
  } catch (e) {
    console.warn('[admin confirm-payment] email dispatch failed:', e)
  }

  return NextResponse.json({ ok: true, role })
}
