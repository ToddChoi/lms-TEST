import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflinePaymentReminderEmail } from '@/lib/email/templates/offline-payment-reminder'
import { OfflinePaymentExpiredEmail } from '@/lib/email/templates/offline-payment-expired'
import { promoteNextWaitlister } from '@/lib/offline/waitlist-promote'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 오프라인 신청 일일 cron — Vercel Hobby 가 daily cron 2 개 한도라 단일 endpoint 로 통합.
 *
 * 매일 새벽 1시 KST (= 16:00 UTC) 실행. 두 작업 순차:
 *
 *   A. expire-pending-payments
 *      status='pending_payment' AND payment_due_at < now() → 'expired'
 *      payment_expired 메일 발송 (멱등 — UNIQUE (enrollment_id, type))
 *
 *   B. send-payment-reminders
 *      payment_due_at - now() 가 [3일 전 ± 12시간] 또는 [1일 전 ± 12시간] 인
 *      pending 신청에 알림. offline_notifications 의 (enrollment_id, type)
 *      partial UNIQUE 가 멱등성 보장 — 재실행 시 중복 INSERT 차단.
 *
 * 인증: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const result = {
    expired_count: 0,
    reminder_3days_count: 0,
    reminder_1day_count: 0,
    errors: [] as string[],
    at: nowIso,
  }

  // ─── A. expire-pending-payments ────────────────────────
  try {
    const { data: expiredRows, error: expireErr } = await (admin as any)
      .from('offline_enrollments')
      .update({
        status: 'expired',
        cancelled_by: 'system_expired',
        cancelled_at: nowIso,
      })
      .eq('status', 'pending_payment')
      .lt('payment_due_at', nowIso)
      .is('deleted_at', null)
      .select(`
        id, session_id, applicant_user_id, company_contact_email, company_contact_name,
        offline_sessions ( title, start_date, end_date,
          offline_programs ( title, slug )
        )
      `)

    if (expireErr) {
      result.errors.push(`expire failed: ${expireErr.message}`)
    } else {
      const expired = (expiredRows as any[]) ?? []
      result.expired_count = expired.length

      // payment_expired 메일 (best effort) + 대기열 승격
      // pending_payment 만료는 confirmed 가 아니라 정원에 영향 X — 승격 불필요.
      // 단 expired 후에도 대기열 처리 일관성 위해 한번 시도 (잔여석 있으면 승격, 없으면 무동작).
      for (const e of expired) {
        try {
          await dispatchExpiredEmail(admin, e)
        } catch (mailErr) {
          console.warn('[cron offline daily] expired email failed:', e.id, mailErr)
        }
        if (e.session_id) {
          await promoteNextWaitlister(admin, e.session_id).catch(() => undefined)
        }
      }
    }
  } catch (err) {
    result.errors.push(`expire stage: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // ─── B. send-payment-reminders ─────────────────────────
  // 3일 전 (72-60시간 후) 또는 1일 전 (24-12시간 후) 신청 추출.
  // payment_due_at BETWEEN now()+12h AND now()+96h 한 번에 가져온 후 분류.
  try {
    const upper = new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString() // +96h
    const lower = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // +12h

    const { data: dueRows } = await admin
      .from('offline_enrollments')
      .select(`
        id, applicant_user_id, total_amount, vat_included, payment_due_at,
        payment_method, company_contact_email, company_contact_name,
        offline_sessions ( title, start_date, end_date,
          offline_programs ( title )
        )
      `)
      .eq('status', 'pending_payment')
      .gte('payment_due_at', lower)
      .lt('payment_due_at', upper)
      .is('deleted_at', null)

    const due = ((dueRows as unknown as any[]) ?? [])

    for (const e of due) {
      const hoursLeft = (new Date(e.payment_due_at).getTime() - Date.now()) / (60 * 60 * 1000)
      let bucket: 1 | 3 | null = null
      if (hoursLeft >= 60 && hoursLeft <= 84) bucket = 3   // 3일 전 ± 12h
      else if (hoursLeft >= 12 && hoursLeft <= 36) bucket = 1   // 1일 전 ± 12h
      if (!bucket) continue

      const notifType = bucket === 3 ? 'payment_due_3days' : 'payment_due_1day'

      // 멱등: 이미 INSERT 됐으면 partial UNIQUE 위반 → 23505 에러 → continue
      try {
        const dispatched = await dispatchReminderEmail(admin, e, bucket, notifType)
        if (dispatched) {
          if (bucket === 3) result.reminder_3days_count++
          else result.reminder_1day_count++
        }
      } catch (mailErr) {
        console.warn('[cron offline daily] reminder failed:', e.id, mailErr)
      }
    }
  } catch (err) {
    result.errors.push(`reminder stage: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // ─── C. expire-waitlist-grace ───────────────────────────
  // status='notified' AND reservation_deadline < now() → 'expired' + 다음 1순위 승격
  let waitlistExpired = 0
  try {
    const { data: expiredWaitRows } = await (admin as any)
      .from('offline_waitlist')
      .update({ status: 'expired' })
      .eq('status', 'notified')
      .lt('reservation_deadline', nowIso)
      .select('id, session_id')

    const expiredWl = ((expiredWaitRows as unknown as Array<{ id: string; session_id: string }>) ?? [])
    waitlistExpired = expiredWl.length

    // 각 expired session 에 다음 순위 승격 (best effort)
    const seenSessions = new Set<string>()
    for (const w of expiredWl) {
      if (seenSessions.has(w.session_id)) continue
      seenSessions.add(w.session_id)
      await promoteNextWaitlister(admin, w.session_id).catch(() => undefined)
    }
  } catch (err) {
    result.errors.push(`waitlist grace stage: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  return NextResponse.json({ ok: true, waitlist_expired_count: waitlistExpired, ...result })
}

export const POST = GET

// ─── helpers ────────────────────────────────────────────

async function dispatchExpiredEmail(admin: ReturnType<typeof createAdminClient>, e: any) {
  const sess = e.offline_sessions
  if (!sess) return

  const { data: profile } = await admin
    .from('profiles').select('email, name').eq('id', e.applicant_user_id).maybeSingle()
  const recipientEmail = e.company_contact_email ?? (profile as any)?.email
  const recipientName = e.company_contact_name ?? (profile as any)?.name
  if (!recipientEmail) return

  const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
  const programSlug = sess.offline_programs?.slug
  const sessionPeriod =
    sess.start_date === sess.end_date
      ? formatDate(sess.start_date)
      : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

  const emailRes = await sendEmail({
    to: recipientEmail,
    subject: `[기한 만료] ${programTitle}`,
    template: 'offline-payment-expired',
    userId: e.applicant_user_id,
    react: OfflinePaymentExpiredEmail({
      name: recipientName,
      programTitle,
      sessionLabel: sess.title ?? '',
      sessionPeriod,
      programSlug,
    }),
  })

  // notifications: 이미 sent 인 expired 알림 있으면 partial UNIQUE 로 차단됨 (멱등)
  try {
    await (admin as any).from('offline_notifications').insert({
      enrollment_id: e.id,
      user_id: e.applicant_user_id,
      type: 'payment_expired',
      channels: ['email'],
      scheduled_at: new Date().toISOString(),
      subject: `[기한 만료] ${programTitle}`,
      status: emailRes.ok ? 'sent' : 'failed',
      email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
      error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
    })
  } catch (err: any) {
    if (err?.code !== '23505') throw err
  }
}

async function dispatchReminderEmail(
  admin: ReturnType<typeof createAdminClient>,
  e: any,
  bucket: 1 | 3,
  notifType: 'payment_due_3days' | 'payment_due_1day'
): Promise<boolean> {
  const sess = e.offline_sessions
  if (!sess) return false

  const { data: profile } = await admin
    .from('profiles').select('email, name').eq('id', e.applicant_user_id).maybeSingle()
  const recipientEmail = e.company_contact_email ?? (profile as any)?.email
  const recipientName = e.company_contact_name ?? (profile as any)?.name
  if (!recipientEmail) return false

  const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
  const sessionPeriod =
    sess.start_date === sess.end_date
      ? formatDate(sess.start_date)
      : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

  // 멱등 — INSERT 먼저 시도. UNIQUE 위반이면 이미 발송 → return false.
  try {
    const { error: insertErr } = await (admin as any)
      .from('offline_notifications')
      .insert({
        enrollment_id: e.id,
        user_id: e.applicant_user_id,
        type: notifType,
        channels: ['email'],
        scheduled_at: new Date().toISOString(),
        subject: `[결제 ${bucket}일 전] ${programTitle}`,
        status: 'pending',
      })

    if (insertErr) {
      // 23505 = unique violation = 이미 발송됨, 멱등 무동작
      if (insertErr.code === '23505') return false
      throw insertErr
    }
  } catch {
    return false
  }

  // 메일 발송
  const emailRes = await sendEmail({
    to: recipientEmail,
    subject: `[결제 ${bucket}일 전] ${programTitle}`,
    template: 'offline-payment-reminder',
    userId: e.applicant_user_id,
    react: OfflinePaymentReminderEmail({
      name: recipientName,
      programTitle,
      sessionLabel: sess.title ?? '',
      sessionPeriod,
      totalAmount: e.total_amount,
      vatIncluded: e.vat_included,
      paymentDueAt: e.payment_due_at,
      enrollmentId: e.id,
      paymentMethod: e.payment_method,
      daysLeft: bucket,
    }),
  })

  // 발송 결과로 status 업데이트
  await (admin as any)
    .from('offline_notifications')
    .update({
      status: emailRes.ok ? 'sent' : 'failed',
      email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
      error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
    })
    .eq('enrollment_id', e.id)
    .eq('type', notifType)

  return true
}
