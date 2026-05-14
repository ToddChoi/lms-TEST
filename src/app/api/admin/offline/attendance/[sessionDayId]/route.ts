import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PutBody {
  enrollment_id?: string
  attendee_id?: string | null
  user_id?: string | null
  status?: 'present' | 'absent' | 'late'
  notes?: string | null
}

/**
 * PUT /api/admin/offline/attendance/[sessionDayId]
 *
 * 출석 보정 — upsert 패턴.
 *   - 이미 row 있으면 UPDATE
 *   - 없으면 INSERT (checked_by='admin')
 * partial UNIQUE 인덱스 (user_id 또는 attendee_id) 활용.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionDayId: string } }
) {
  const { guard, user } = await requireAdmin()
  if (guard) return guard

  const body = (await req.json().catch(() => ({}))) as PutBody
  const {
    enrollment_id,
    attendee_id,
    user_id,
    status,
    notes,
  } = body

  if (!enrollment_id || !status) {
    return NextResponse.json({ error: 'enrollment_id / status 필수' }, { status: 400 })
  }
  if (!['present', 'absent', 'late'].includes(status)) {
    return NextResponse.json({ error: '잘못된 status' }, { status: 400 })
  }
  if (!attendee_id && !user_id) {
    return NextResponse.json({ error: 'attendee_id 또는 user_id 필요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 기존 row 찾기 (partial unique 활용 패턴)
  let existingQuery = (admin as any)
    .from('offline_attendance')
    .select('id')
    .eq('session_day_id', params.sessionDayId)
    .eq('enrollment_id', enrollment_id)
  if (attendee_id) existingQuery = existingQuery.eq('attendee_id', attendee_id).is('user_id', null)
  else existingQuery = existingQuery.eq('user_id', user_id).is('attendee_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    const { error } = await (admin as any)
      .from('offline_attendance')
      .update({
        status,
        checked_at: now,
        checked_by: 'admin',
        checked_by_admin_id: user!.id,
        notes: notes ?? null,
      })
      .eq('id', (existing as { id: string }).id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, updated: true })
  }

  // INSERT
  const insertData: Record<string, unknown> = {
    session_day_id: params.sessionDayId,
    enrollment_id,
    status,
    checked_at: now,
    checked_by: 'admin',
    checked_by_admin_id: user!.id,
    notes: notes ?? null,
  }
  if (attendee_id) insertData.attendee_id = attendee_id
  else insertData.user_id = user_id

  const { error: insertErr } = await (admin as any)
    .from('offline_attendance')
    .insert(insertData)

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created: true })
}
