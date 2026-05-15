'use server'

/**
 * Server Actions — 강좌 sections + lessons CRUD.
 * Phase C5 — /api/admin/sections + /api/admin/lessons 두 Route Handler 통합.
 *
 * SectionManager 가 부르는 6종 mutation 을 모두 이곳에.
 * recalcCourseDuration / getCourseId* 헬퍼는 actions 안으로 이동 (Route 시절과 동일).
 */

import { createClient as createAdmin } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'

function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function recalcCourseDuration(courseId: string) {
  const admin = makeAdminClient() as any
  const { data: lessons } = await admin
    .from('lessons')
    .select('duration, sections!inner(course_id)')
    .eq('sections.course_id', courseId)
    .is('deleted_at', null)
  const total = (lessons as any[] ?? []).reduce((sum: number, l: any) => sum + (l.duration ?? 0), 0)
  await admin.from('courses').update({ total_duration: total }).eq('id', courseId)
}

async function getCourseIdBySection(sectionId: string): Promise<string | null> {
  const admin = makeAdminClient() as any
  const { data } = await admin.from('sections').select('course_id').eq('id', sectionId).single()
  return (data as any)?.course_id ?? null
}

async function getCourseIdByLesson(lessonId: string): Promise<string | null> {
  const admin = makeAdminClient() as any
  const { data } = await admin
    .from('lessons')
    .select('section_id, sections(course_id)')
    .eq('id', lessonId)
    .single()
  return (data as any)?.sections?.course_id ?? null
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─────────────────────────── Sections ───────────────────────────

export interface SectionData {
  id: string
  title: string
  sort_order: number
  course_id: string
}

export async function createSectionAction(input: {
  course_id: string
  title: string
  sort_order?: number
}): Promise<ActionResult<SectionData>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  const supabase = sb!

  if (!input.course_id || !input.title?.trim()) {
    return { ok: false, error: 'course_id와 title은 필수입니다.' }
  }

  const { data: rawSection, error } = await (supabase as any)
    .from('sections')
    .insert({ course_id: input.course_id, title: input.title, sort_order: input.sort_order ?? 0 })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/courses/${input.course_id}/sections`)
  revalidatePath(`/admin/courses/${input.course_id}/edit`)
  return { ok: true, data: rawSection as SectionData }
}

export async function updateSectionAction(
  id: string,
  input: { title?: string; sort_order?: number },
): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id is required' }
  const supabase = sb!

  const updateData: Record<string, unknown> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order
  if (Object.keys(updateData).length === 0) {
    return { ok: false, error: '변경할 내용이 없습니다.' }
  }

  const courseId = await getCourseIdBySection(id)
  const { error } = await (supabase as any).from('sections').update(updateData).eq('id', id)
  if (error) return { ok: false, error: error.message }

  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}/sections`)
    revalidatePath(`/admin/courses/${courseId}/edit`)
  }
  return { ok: true, data: null }
}

/**
 * ⚠️ section hard delete — cascade FK 가 lessons → lesson_progress 까지 영구 삭제.
 * lesson 단건은 soft delete (P1 데이터 정합성) 이지만 section 통째 삭제는 별도 후속.
 * 운영자가 confirm 한 의도로 간주 → cascade 그대로.
 */
export async function deleteSectionAction(id: string): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id is required' }
  const supabase = sb!

  const courseId = await getCourseIdBySection(id)

  await (supabase as any).from('lessons').delete().eq('section_id', id)
  const { error } = await (supabase as any).from('sections').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  if (courseId) {
    revalidatePath(`/admin/courses/${courseId}/sections`)
    revalidatePath(`/admin/courses/${courseId}/edit`)
  }
  return { ok: true, data: null }
}

// ─────────────────────────── Lessons ───────────────────────────

export interface LessonData {
  id: string
  section_id: string
  course_id: string
  title: string
  video_url: string | null
  duration: number
  is_preview: boolean
  sort_order: number
}

export async function createLessonAction(input: {
  section_id: string
  title: string
  video_url?: string | null
  duration?: number
  is_preview?: boolean
  sort_order?: number
}): Promise<ActionResult<LessonData>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  const supabase = sb!

  if (!input.section_id || !input.title?.trim()) {
    return { ok: false, error: 'section_id와 title은 필수입니다.' }
  }

  // ★ P1.2 — lessons.course_id 도 INSERT (RLS / 진도율 / 잠긴 강의 조회 위해).
  const courseId = await getCourseIdBySection(input.section_id)
  if (!courseId) return { ok: false, error: '존재하지 않는 section_id 입니다.' }

  const { data: rawLesson, error } = await (supabase as any)
    .from('lessons')
    .insert({
      section_id: input.section_id,
      course_id: courseId,
      title: input.title,
      video_url: input.video_url ?? null,
      duration: typeof input.duration === 'number' ? input.duration : 0,
      is_preview: input.is_preview ?? false,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  await recalcCourseDuration(courseId)
  revalidatePath(`/admin/courses/${courseId}/sections`)
  revalidatePath(`/admin/courses/${courseId}/edit`)
  return { ok: true, data: rawLesson as LessonData }
}

export async function updateLessonAction(
  id: string,
  input: {
    title?: string
    video_url?: string | null
    duration?: number
    is_preview?: boolean
    sort_order?: number
    /** true 면 deleted_at = null 로 복원 (다른 필드는 무시) */
    restore?: boolean
  },
): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id is required' }
  const supabase = sb!

  const courseId = await getCourseIdByLesson(id)

  const updateData: Record<string, unknown> = {}
  if (input.restore === true) {
    updateData.deleted_at = null
  } else {
    if (input.title !== undefined) updateData.title = input.title
    if (input.video_url !== undefined) updateData.video_url = input.video_url
    if (input.duration !== undefined) updateData.duration = input.duration
    if (input.is_preview !== undefined) updateData.is_preview = input.is_preview
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order
  }

  if (Object.keys(updateData).length === 0) {
    return { ok: false, error: '변경할 내용이 없습니다.' }
  }

  const { error } = await (supabase as any).from('lessons').update(updateData).eq('id', id)
  if (error) return { ok: false, error: error.message }

  if (courseId) {
    await recalcCourseDuration(courseId)
    revalidatePath(`/admin/courses/${courseId}/sections`)
    revalidatePath(`/admin/courses/${courseId}/edit`)
  }
  return { ok: true, data: null }
}

/**
 * lesson soft delete — deleted_at = now().
 * lesson_progress / 통계 / 수료증 보존. 휴지통에서 복원 가능.
 */
export async function deleteLessonAction(id: string): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id is required' }
  const supabase = sb!

  const courseId = await getCourseIdByLesson(id)

  const { error } = await (supabase as any)
    .from('lessons')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null) // 멱등

  if (error) return { ok: false, error: error.message }

  if (courseId) {
    await recalcCourseDuration(courseId)
    revalidatePath(`/admin/courses/${courseId}/sections`)
    revalidatePath(`/admin/courses/${courseId}/edit`)
  }
  return { ok: true, data: null }
}
