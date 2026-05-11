import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import type { OfflineProgramType, OfflineProgramStatus } from '@/types/database'

const PROGRAM_TYPES: OfflineProgramType[] = ['workshop', 'regular_course', 'corporate']
const PROGRAM_STATUSES: OfflineProgramStatus[] = ['draft', 'active', 'closed']
const SLUG_RE = /^[a-z0-9가-힣-]+$/

interface ProgramUpdate {
  title: string
  slug: string
  description: string | null
  category_id: string | null
  thumbnail_url: string | null
  program_type: OfflineProgramType
  instructor_name: string | null
  instructor_bio: string | null
  what_you_learn: string[]
  requirements: string[]
  target_audience: string | null
  completion_attendance_rate: number
  status: OfflineProgramStatus
  is_featured: boolean
}

function validate(body: unknown): { ok: true; value: ProgramUpdate } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' }
  const b = body as Record<string, unknown>

  const title = String(b.title ?? '').trim()
  if (title.length < 2) return { ok: false, error: '프로그램명은 2자 이상' }
  const slug = String(b.slug ?? '').trim()
  if (slug.length < 2 || !SLUG_RE.test(slug)) return { ok: false, error: '슬러그 형식 오류' }
  const program_type = b.program_type as OfflineProgramType
  if (!PROGRAM_TYPES.includes(program_type)) return { ok: false, error: '유형 값 오류' }
  const status = b.status as OfflineProgramStatus
  if (!PROGRAM_STATUSES.includes(status)) return { ok: false, error: '상태 값 오류' }
  const rate = Number(b.completion_attendance_rate)
  if (!Number.isInteger(rate) || rate < 0 || rate > 100) {
    return { ok: false, error: '수료 출석률은 0~100 정수' }
  }

  const arrField = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []

  return {
    ok: true,
    value: {
      title,
      slug,
      description: b.description ? String(b.description) : null,
      category_id: b.category_id ? String(b.category_id) : null,
      thumbnail_url: b.thumbnail_url ? String(b.thumbnail_url) : null,
      program_type,
      instructor_name: b.instructor_name ? String(b.instructor_name) : null,
      instructor_bio: b.instructor_bio ? String(b.instructor_bio) : null,
      what_you_learn: arrField(b.what_you_learn),
      requirements: arrField(b.requirements),
      target_audience: b.target_audience ? String(b.target_audience) : null,
      completion_attendance_rate: rate,
      status,
      is_featured: !!b.is_featured,
    },
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const v = validate(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { error } = await (supabase as any)
    .from('offline_programs')
    .update(v.value)
    .eq('id', params.id)
    .is('deleted_at', null)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 사용 중인 슬러그입니다.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// 소프트 삭제 — deleted_at = now()
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { error } = await (supabase as any)
    .from('offline_programs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
