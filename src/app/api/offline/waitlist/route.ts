import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PostBody {
  session_id?: string
  attendee_count?: number
}

/**
 * POST /api/offline/waitlist — 대기열 등록.
 *
 * 검증:
 *   - 로그인 필수
 *   - session_id 필수, 회차 존재 + active 상태
 *   - 본인이 이미 active enrollment (pending_payment / confirmed) 면 거부 (이미 신청)
 *   - 본인이 이미 waiting / notified 대기열에 있으면 거부
 *   - 잔여석이 있으면 거부 (대기 불필요 — 직접 신청하라 안내)
 *
 * INSERT 는 admin client (waitlist 가 admin only RLS — 본인 user.id 만 안전 사용).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as PostBody
  const { session_id } = body
  const attendee_count = Number(body.attendee_count ?? 1)
  if (!session_id) {
    return NextResponse.json({ error: '회차 ID 가 필요합니다.' }, { status: 400 })
  }
  if (!Number.isInteger(attendee_count) || attendee_count < 1) {
    return NextResponse.json({ error: '인원수는 1 이상 정수여야 합니다.' }, { status: 400 })
  }

  // 회차 존재 + 상태 확인 (open / closed / completed 모두 대기 가능. cancelled 만 차단)
  const { data: rawSession } = await supabase
    .from('offline_sessions')
    .select('id, status')
    .eq('id', session_id)
    .is('deleted_at', null)
    .maybeSingle()
  const session = rawSession as unknown as { id: string; status: string } | null
  if (!session) {
    return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (session.status === 'cancelled' || session.status === 'completed') {
    return NextResponse.json(
      { error: '대기 신청 가능한 회차가 아닙니다.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // 이미 신청 또는 대기 중인지
  const { data: rawExisting } = await supabase
    .from('offline_enrollments')
    .select('id')
    .eq('session_id', session_id)
    .eq('applicant_user_id', user.id)
    .in('status', ['pending_payment', 'confirmed'])
    .is('deleted_at', null)
    .maybeSingle()
  if (rawExisting) {
    return NextResponse.json(
      { error: '이미 이 회차에 신청한 내역이 있습니다.' },
      { status: 409 }
    )
  }

  const { data: rawWaiting } = await (admin as any)
    .from('offline_waitlist')
    .select('id')
    .eq('session_id', session_id)
    .eq('user_id', user.id)
    .in('status', ['waiting', 'notified'])
    .maybeSingle()
  if (rawWaiting) {
    return NextResponse.json(
      { error: '이미 대기 신청 중입니다.' },
      { status: 409 }
    )
  }

  // 잔여석 확인 — 있으면 직접 신청 권유
  const { data: availData } = await (admin as any).rpc(
    'offline_session_available_seats',
    { p_session_id: session_id }
  )
  const available = typeof availData === 'number' ? availData : Number(availData ?? 0)
  if (available >= attendee_count && session.status === 'open') {
    return NextResponse.json(
      { error: `잔여석이 ${available}석 있습니다. 대기 대신 직접 신청 가능합니다.` },
      { status: 400 }
    )
  }

  // INSERT
  const { data, error } = await (admin as any)
    .from('offline_waitlist')
    .insert({
      session_id,
      user_id: user.id,
      attendee_count,
      status: 'waiting',
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 대기 신청 중입니다.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id })
}
