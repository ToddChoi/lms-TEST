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
 *   2. enrollment status='pending_payment' AND payment_method='invoice' 검증
 *   3. 정원 재검증 (RPC offline_session_available_seats — race-safe)
 *      - 통과: confirmed 전이 + paid_at + invoice_paid_confirmed_by/at
 *      - 초과: cancelled (system_expired) + 안내 메일 (Phase 4 환불 흐름)
 *   4. payment_confirmed 메일 + offline_notifications INSERT
 *
 * 멱등:
 *   - status guard ('pending_payment' 만 업데이트) → 두 번 클릭 시 두 번째는 0 row
 *   - 상태 전이 트리거 (validate_enrollment_status_transition) 가 confirmed →
 *     confirmed 차단 (status IS DISTINCT FROM 검사)
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { guard, user, role } = await requireAdmin()
  if (guard) return guard

  const admin = createAdminClient()

  // enrollment 가져오기
  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, status, payment_method, applicant_user_id, session_id,
      attendee_count, total_amount,
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
    total_amount: number
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

  // 정원 재검증 (confirmed 만 카운트)
  const { data: availData } = await (admin as any).rpc(
    'offline_session_available_seats',
    { p_session_id: enrollment.session_id }
  )
  const available = typeof availData === 'number' ? availData : Number(availData ?? 0)

  if (available < enrollment.attendee_count) {
    // 정원 초과 — cancelled 처리. Phase 4 의 환불 흐름은 운영자 수동 (오프라인 환불).
    await (admin as any)
      .from('offline_enrollments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        notes: `입금 확인 시점 정원 초과 (요청 ${enrollment.attendee_count}, 잔여 ${available}). 환불 처리 필요.`,
      })
      .eq('id', enrollment.id)
      .eq('status', 'pending_payment')

    await (admin as any).from('offline_audit_log').insert({
      entity_type: 'enrollment',
      entity_id: enrollment.id,
      action: 'capacity_exceeded_at_confirm',
      actor_user_id: user!.id,
      actor_type: 'admin',
      diff: { available, requested: enrollment.attendee_count },
    })

    return NextResponse.json({
      ok: false,
      error: `정원 초과로 자동 취소되었습니다. (잔여 ${available}석, 요청 ${enrollment.attendee_count}명) 환불 처리가 필요합니다.`,
    }, { status: 409 })
  }

  // confirmed 전이
  const { data: updateData, error: updateErr } = await (admin as any)
    .from('offline_enrollments')
    .update({
      status: 'confirmed',
      paid_at: new Date().toISOString(),
      invoice_paid_confirmed_at: new Date().toISOString(),
      invoice_paid_confirmed_by: user!.id,
    })
    .eq('id', enrollment.id)
    .eq('status', 'pending_payment')  // race-safe
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }
  if (!Array.isArray(updateData) || updateData.length === 0) {
    return NextResponse.json(
      { error: '이미 다른 처리가 진행됐습니다. 새로고침 후 확인해주세요.' },
      { status: 409 }
    )
  }

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
