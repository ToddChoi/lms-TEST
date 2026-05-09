import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// 강좌의 total_duration 재계산 후 업데이트
async function recalcCourseDuration(courseId: string) {
  const admin = makeAdminClient() as any

  // 해당 강좌의 모든 lesson duration 합산
  const { data: lessons } = await admin
    .from('lessons')
    .select('duration, sections!inner(course_id)')
    .eq('sections.course_id', courseId)

  const total = (lessons as any[] ?? []).reduce((sum: number, l: any) => sum + (l.duration ?? 0), 0)

  await admin
    .from('courses')
    .update({ total_duration: total })
    .eq('id', courseId)
}

// section_id → course_id 조회
async function getCourseIdBySection(sectionId: string): Promise<string | null> {
  const admin = makeAdminClient() as any
  const { data } = await admin
    .from('sections')
    .select('course_id')
    .eq('id', sectionId)
    .single()
  return (data as any)?.course_id ?? null
}

// lesson_id → course_id 조회
async function getCourseIdByLesson(lessonId: string): Promise<string | null> {
  const admin = makeAdminClient() as any
  const { data } = await admin
    .from('lessons')
    .select('section_id, sections(course_id)')
    .eq('id', lessonId)
    .single()
  return (data as any)?.sections?.course_id ?? null
}

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { section_id, title, video_url, duration, is_preview, sort_order } = body

  if (!section_id || !title?.trim()) {
    return NextResponse.json({ error: 'section_id와 title은 필수입니다.' }, { status: 400 })
  }

  // ★ P1.2 — lessons.course_id 도 INSERT.
  // 기존 코드는 section_id 만 저장 → RLS 정책(course_id 기반) / 진도율 계산 /
  // 잠긴 강의 조회가 silent 로 어긋나던 버그.
  const courseId = await getCourseIdBySection(section_id)
  if (!courseId) {
    return NextResponse.json({ error: '존재하지 않는 section_id 입니다.' }, { status: 400 })
  }

  const { data: rawLesson, error } = await (supabase as any)
    .from('lessons')
    .insert({
      section_id,
      course_id: courseId,
      title,
      video_url: video_url ?? null,
      duration: typeof duration === 'number' ? duration : 0,
      is_preview: is_preview ?? false,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recalcCourseDuration(courseId)

  return NextResponse.json({ lesson: rawLesson })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, title, video_url, duration, is_preview, sort_order } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // 변경 전 course_id 먼저 조회
  const courseId = await getCourseIdByLesson(id)

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (video_url !== undefined) updateData.video_url = video_url
  if (duration !== undefined) updateData.duration = duration
  if (is_preview !== undefined) updateData.is_preview = is_preview
  if (sort_order !== undefined) updateData.sort_order = sort_order

  const { error } = await (supabase as any)
    .from('lessons')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // total_duration 재계산
  if (courseId) await recalcCourseDuration(courseId)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // 삭제 전 course_id 먼저 조회
  const courseId = await getCourseIdByLesson(id)

  const { error } = await (supabase as any)
    .from('lessons')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // total_duration 재계산
  if (courseId) await recalcCourseDuration(courseId)

  return NextResponse.json({ success: true })
}
