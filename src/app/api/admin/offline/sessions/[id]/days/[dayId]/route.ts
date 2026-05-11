import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

interface DayUpdate {
  day_number: number
  date: string
  start_time: string
  end_time: string
  topic: string | null
}

function validate(body: unknown): { ok: true; value: DayUpdate } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' }
  const b = body as Record<string, unknown>

  const day_number = Number(b.day_number)
  if (!Number.isInteger(day_number) || day_number < 1) {
    return { ok: false, error: '일차는 1 이상 정수' }
  }
  const date = String(b.date ?? '')
  if (!ISO_DATE_RE.test(date)) return { ok: false, error: '날짜 형식 오류' }
  const start_time = String(b.start_time ?? '')
  const end_time = String(b.end_time ?? '')
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
    return { ok: false, error: '시간 형식 오류' }
  }
  const norm = (t: string): string => (t.length === 5 ? `${t}:00` : t)
  const ns = norm(start_time)
  const ne = norm(end_time)
  if (ne <= ns) return { ok: false, error: '종료 시간이 시작 시간보다 빨라요.' }

  return {
    ok: true,
    value: {
      day_number,
      date,
      start_time: ns,
      end_time: ne,
      topic: b.topic ? String(b.topic) : null,
    },
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const v = validate(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // qr_token 은 변경 X — 트리거가 date / start_time 변경 시 qr_active_from/until 재계산
  const { error } = await (supabase as any)
    .from('offline_session_days')
    .update(v.value)
    .eq('id', params.dayId)
    .eq('session_id', params.id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `${v.value.day_number}일차가 이미 존재합니다.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// 회차 일자 hard delete (출석 데이터는 ON DELETE CASCADE 로 같이 삭제됨 — 주의)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { error } = await (supabase as any)
    .from('offline_session_days')
    .delete()
    .eq('id', params.dayId)
    .eq('session_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
