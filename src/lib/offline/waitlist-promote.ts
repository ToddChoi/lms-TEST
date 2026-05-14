import type { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflineWaitlistAvailableEmail } from '@/lib/email/templates/offline-waitlist-available'
import { formatDate } from '@/lib/utils'

/**
 * 자리 발생 시 대기열 1순위 자동 승격.
 *
 * 호출 시점:
 *   - 사용자 자발 취소 (POST /api/offline/cancel/[enrollmentId])
 *   - 관리자 취소 (POST /api/admin/offline/enrollments/[id]/cancel — Phase 4 3/3)
 *   - 결제 기한 만료 cron (/api/cron/offline/daily 의 expire 단계)
 *
 * 동작:
 *   1. 잔여석 재계산 (offline_session_available_seats RPC)
 *   2. status='waiting' 중 created_at 가장 빠른 1건 fetch
 *   3. waiting → notified 전이 + notified_at + reservation_deadline (now + grace_hours)
 *   4. waitlist_available 메일 + offline_notifications INSERT (기존 enrollment_id
 *      매핑 X — waitlist 알림은 enrollment_id NULL 로 INSERT — UNIQUE 부분 인덱스가
 *      enrollment_id IS NOT NULL 일 때만 동작이라 중복 OK)
 *
 * 멱등 / race-safe:
 *   - waiting → notified UPDATE 시 status='waiting' guard (다른 cron 이 먼저 처리하면 0 row)
 *   - 잔여석이 부족하면 무동작
 *
 * 에러는 throw 하지 않고 console.warn — 호출자의 주 흐름 (취소/만료) 이 실패하면 안 됨.
 */
export async function promoteNextWaitlister(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<{ promoted: boolean; userId?: string; reason?: string }> {
  try {
    // 1. 잔여석 확인
    const { data: availData } = await (admin as any).rpc(
      'offline_session_available_seats',
      { p_session_id: sessionId }
    )
    const available = typeof availData === 'number' ? availData : Number(availData ?? 0)
    if (available <= 0) {
      return { promoted: false, reason: 'no_seats' }
    }

    // 2. 1순위 (created_at ASC, status='waiting')
    const { data: rawWaiter } = await (admin as any)
      .from('offline_waitlist')
      .select('id, user_id, attendee_count, session_id')
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const waiter = rawWaiter as {
      id: string
      user_id: string
      attendee_count: number
      session_id: string
    } | null

    if (!waiter) return { promoted: false, reason: 'no_waiter' }
    if (waiter.attendee_count > available) {
      return { promoted: false, reason: 'attendee_count_exceeds_seats' }
    }

    // 3. grace hours 가져오기 (글로벌 settings)
    const { data: rawGrace } = await (admin as any)
      .from('site_settings')
      .select('value')
      .eq('key', 'offline_waitlist_grace_hours')
      .maybeSingle()
    const graceHours = Number((rawGrace as { value: string } | null)?.value ?? '24')
    const reservationDeadline = new Date(
      Date.now() + graceHours * 60 * 60 * 1000
    ).toISOString()

    // 4. waiting → notified (race-safe)
    const { data: updated, error: updateErr } = await (admin as any)
      .from('offline_waitlist')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        reservation_deadline: reservationDeadline,
      })
      .eq('id', waiter.id)
      .eq('status', 'waiting')
      .select('id')

    if (updateErr || !Array.isArray(updated) || updated.length === 0) {
      return { promoted: false, reason: 'race_lost' }
    }

    // 5. 회차 + 프로그램 + 사용자 정보 fetch (메일 용)
    const { data: rawSession } = await (admin as any)
      .from('offline_sessions')
      .select('title, start_date, end_date, offline_programs(title, slug)')
      .eq('id', sessionId)
      .maybeSingle()
    const sess = rawSession as {
      title: string | null
      start_date: string
      end_date: string
      offline_programs: { title: string; slug: string } | null
    } | null

    const { data: rawProfile } = await (admin as any)
      .from('profiles').select('email, name').eq('id', waiter.user_id).maybeSingle()
    const profile = rawProfile as { email: string | null; name: string | null } | null

    if (sess && profile?.email) {
      const programTitle = sess.offline_programs?.title ?? '오프라인 교육'
      const programSlug = sess.offline_programs?.slug ?? ''
      const sessionPeriod =
        sess.start_date === sess.end_date
          ? formatDate(sess.start_date)
          : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`

      const emailRes = await sendEmail({
        to: profile.email,
        subject: `[자리 발생] ${programTitle}`,
        template: 'offline-waitlist-available',
        userId: waiter.user_id,
        react: OfflineWaitlistAvailableEmail({
          name: profile.name,
          programTitle,
          sessionLabel: sess.title ?? '',
          sessionPeriod,
          programSlug,
          sessionId,
          reservationDeadline,
          graceHours,
        }),
      })

      // notifications: enrollment_id 없음 (waitlist 알림). UNIQUE partial index 가
      // enrollment_id IS NOT NULL 일 때만이라 중복 INSERT 가능.
      await (admin as any).from('offline_notifications').insert({
        user_id: waiter.user_id,
        type: 'waitlist_available',
        channels: ['email'],
        scheduled_at: new Date().toISOString(),
        subject: `[자리 발생] ${programTitle}`,
        status: emailRes.ok ? 'sent' : 'failed',
        email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
        error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
      })
    }

    return { promoted: true, userId: waiter.user_id }
  } catch (err) {
    console.warn('[waitlist-promote] failed for session', sessionId, err)
    return { promoted: false, reason: 'exception' }
  }
}
