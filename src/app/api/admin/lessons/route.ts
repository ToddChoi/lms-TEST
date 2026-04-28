import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function checkAdmin(supabase: ReturnType<typeof makeSupabase>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) return null
  return user
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
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { section_id, title, video_url, duration, is_preview, sort_order } = body

  if (!section_id || !title?.trim()) {
    return NextResponse.json({ error: 'section_id와 title은 필수입니다.' }, { status: 400 })
  }

  const { data: rawLesson, error } = await (supabase as any)
    .from('lessons')
    .insert({
      section_id,
      title,
      video_url: video_url ?? null,
      duration: typeof duration === 'number' ? duration : 0,
      is_preview: is_preview ?? false,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // total_duration 재계산
  const courseId = await getCourseIdBySection(section_id)
  if (courseId) await recalcCourseDuration(courseId)

  return NextResponse.json({ lesson: rawLesson })
}

export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
