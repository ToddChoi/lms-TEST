import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PostBody {
  token?: string
}

/**
 * QR 출석 체크 — POST /api/offline/attendance/check-in
 *
 * 흐름:
 *   1. 로그인 필수
 *   2. token 으로 offline_session_days fetch (admin client — RLS 의 confirmed
 *      신청자 read 정책이 있지만 token 자체 검증을 위해 admin 사용)
 *   3. 활성 시간 검증 (qr_active_from <= now <= qr_active_until)
 *   4. 본인이 해당 session 의 confirmed 신청자인지 검증
 *      - applicant_user_id 매칭 (개인) OR offline_attendees.user_id 매칭 (단체 — 매칭된 경우)
 *      - 또는 단체 신청자가 본인 이메일과 attendees.email 매칭 (자동 연결)
 *   5. offline_attendance INSERT (status='present', checked_by='self_qr')
 *      - partial UNIQUE (session_day_id, enrollment_id, user_id) 또는
 *        (session_day_id, enrollment_id, attendee_id) → 중복 INSERT 차단
 */
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as PostBody
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'QR 토큰이 없습니다.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // QR 토큰 → session_day
  const { data: rawDay } = await (admin as any)
    .from('offline_session_days')
    .select('id, session_id, date, day_number, qr_active_from, qr_active_until, topic')
    .eq('qr_token', token)
    .maybeSingle()

  const day = rawDay as unknown as {
    id: string
    session_id: string
    date: string
    day_number: number
    qr_active_from: string
    qr_active_until: string
    topic: string | null
  } | null

  if (!day) {
    return NextResponse.json({ error: '유효하지 않은 QR 코드입니다.' }, { status: 400 })
  }

  const now = new Date()
  if (new Date(day.qr_active_from) > now || new Date(day.qr_active_until) < now) {
    return NextResponse.json(
      {
        error: 'QR 코드 활성 시간이 아닙니다.',
        active_from: day.qr_active_from,
        active_until: day.qr_active_until,
      },
      { status: 400 }
    )
  }

  // 본인 confirmed enrollment 찾기 — 개인 (applicant_user_id) 또는 단체 (matched attendee)
  // 개인 케이스
  const { data: rawIndividual } = await admin
    .from('offline_enrollments')
    .select('id, applicant_type')
    .eq('session_id', day.session_id)
    .eq('applicant_user_id', user.id)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .maybeSingle()
  const individualEnrollment = rawIndividual as unknown as {
    id: string
    applicant_type: 'individual' | 'corporate'
  } | null

  let enrollmentId: string | null = null
  let attendeeId: string | null = null

  if (individualEnrollment && individualEnrollment.applicant_type === 'individual') {
    enrollmentId = individualEnrollment.id
    // user_id 만 채움
  } else {
    // 단체 — attendees 중 user_id 매칭 OR email 매칭 (자동 link)
    const { data: rawAttendee } = await (admin as any)
      .from('offline_attendees')
      .select(`
        id, email, user_id, enrollment_id,
        offline_enrollments!inner ( id, status, session_id, deleted_at )
      `)
      .eq('offline_enrollments.session_id', day.session_id)
      .eq('offline_enrollments.status', 'confirmed')
      .is('cancelled_at', null)
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle()
    const attendee = rawAttendee as unknown as {
      id: string
      email: string | null
      user_id: string | null
      enrollment_id: string
    } | null

    if (attendee) {
      enrollmentId = attendee.enrollment_id
      attendeeId = attendee.id
      // 자동 user_id link (email 매칭이었으면 user_id 채워줌)
      if (!attendee.user_id) {
        await (admin as any)
          .from('offline_attendees')
          .update({ user_id: user.id })
          .eq('id', attendee.id)
      }
    }
  }

  if (!enrollmentId) {
    return NextResponse.json(
      { error: '해당 회차의 결제 완료 신청자가 아닙니다.' },
      { status: 403 }
    )
  }

  // 출석 INSERT — partial UNIQUE 위반 시 (이미 출석) catch → idempotent
  const insertData: Record<string, unknown> = {
    session_day_id: day.id,
    enrollment_id: enrollmentId,
    status: 'present',
    checked_at: now.toISOString(),
    checked_by: 'self_qr',
  }
  if (attendeeId) insertData.attendee_id = attendeeId
  else insertData.user_id = user.id

  const { error: insertErr } = await (admin as any)
    .from('offline_attendance')
    .insert(insertData)

  if (insertErr) {
    if (insertErr.code === '23505') {
      // 이미 체크됨 — 멱등 OK
      return NextResponse.json({
        ok: true,
        idempotent: true,
        message: '이미 출석 체크되어 있습니다.',
        day: { date: day.date, day_number: day.day_number, topic: day.topic },
      })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // 알림 — 사이트 내 (in_app) 만 (Phase 6 cron 통합 — 이번엔 단순 INSERT)
  await (admin as any).from('offline_notifications').insert({
    enrollment_id: enrollmentId,
    user_id: user.id,
    type: 'attendance_checked_in',
    channels: ['in_app'],
    scheduled_at: now.toISOString(),
    subject: '출석 완료',
    body: `${day.day_number}일차 출석 체크 완료 (${day.date})`,
    status: 'sent',
  })

  return NextResponse.json({
    ok: true,
    day: { date: day.date, day_number: day.day_number, topic: day.topic },
  })
}
