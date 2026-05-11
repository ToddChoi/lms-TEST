import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import { generateQrToken } from '@/lib/offline/qr'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

interface DayInput {
  day_number: number
  date: string
  start_time: string
  end_time: string
  topic: string | null
}

function validate(body: unknown): { ok: true; value: DayInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' }
  const b = body as Record<string, unknown>

  const day_number = Number(b.day_number)
  if (!Number.isInteger(day_number) || day_number < 1) {
    return { ok: false, error: '일차는 1 이상 정수' }
  }
  const date = String(b.date ?? '')
  if (!ISO_DATE_RE.test(date)) return { ok: false, error: '날짜 형식 오류 (YYYY-MM-DD)' }
  const start_time = String(b.start_time ?? '')
  const end_time = String(b.end_time ?? '')
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
    return { ok: false, error: '시간 형식 오류 (HH:MM 또는 HH:MM:SS)' }
  }
  // input[type=time] 은 HH:MM 만 보내므로 :00 보강
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const v = validate(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // 회차 존재 + 미삭제 확인
  const { data: rawSession } = await supabase
    .from('offline_sessions').select('id').eq('id', params.id).is('deleted_at', null).maybeSingle()
  if (!rawSession) {
    return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })
  }

  // QR 토큰 생성 (32바이트 base64url ≈ 43자)
  const qrToken = generateQrToken()

  // qr_active_from / qr_active_until 은 set_qr_active_window 트리거가 자동 계산.
  // 그러나 NOT NULL 컬럼이라 INSERT 시점에 placeholder 값 필요 — epoch 0 으로 채워두면
  // 트리거가 BEFORE INSERT 에서 덮어씀.
  const placeholder = '1970-01-01T00:00:00Z'

  const { data, error } = await (supabase as any)
    .from('offline_session_days')
    .insert({
      session_id: params.id,
      day_number: v.value.day_number,
      date: v.value.date,
      start_time: v.value.start_time,
      end_time: v.value.end_time,
      topic: v.value.topic,
      qr_token: qrToken,
      qr_active_from: placeholder,
      qr_active_until: placeholder,
    })
    .select('id')
    .single()

  if (error) {
    // 일차 중복 (UNIQUE session_id + day_number) — 23505
    if (error.code === '23505') {
      return NextResponse.json({ error: `${v.value.day_number}일차가 이미 존재합니다.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
