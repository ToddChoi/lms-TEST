'use server'

/**
 * Server Actions — 오프라인 프로그램 CRUD.
 * Phase C3 — Route Handlers POST + PUT + DELETE 마이그.
 *
 * 패턴: controlled form (useState) + useTransition + 직접 호출.
 * 입력 객체는 ProgramInput 타입으로 정의 (formData 가 아닌 typed object).
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'
import type { OfflineProgramType, OfflineProgramStatus } from '@/types/database'

const PROGRAM_TYPES: OfflineProgramType[] = ['workshop', 'regular_course', 'corporate']
const PROGRAM_STATUSES: OfflineProgramStatus[] = ['draft', 'active', 'closed']
const SLUG_RE = /^[a-z0-9가-힣-]+$/

export interface ProgramInput {
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

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function validate(input: ProgramInput): { ok: true; value: ProgramInput } | { ok: false; error: string } {
  const title = input.title?.trim() ?? ''
  if (title.length < 2) return { ok: false, error: '프로그램명은 2자 이상' }
  const slug = input.slug?.trim() ?? ''
  if (slug.length < 2 || !SLUG_RE.test(slug)) return { ok: false, error: '슬러그 형식 오류 (영문 소문자/숫자/한글/하이픈, 2자 이상)' }
  if (!PROGRAM_TYPES.includes(input.program_type)) return { ok: false, error: '유형 값 오류' }
  if (!PROGRAM_STATUSES.includes(input.status)) return { ok: false, error: '상태 값 오류' }
  if (!Number.isInteger(input.completion_attendance_rate) || input.completion_attendance_rate < 0 || input.completion_attendance_rate > 100) {
    return { ok: false, error: '수료 출석률은 0~100 정수' }
  }
  return {
    ok: true,
    value: {
      ...input,
      title,
      slug,
      what_you_learn: (input.what_you_learn ?? []).map((x) => String(x).trim()).filter(Boolean),
      requirements: (input.requirements ?? []).map((x) => String(x).trim()).filter(Boolean),
    },
  }
}

export async function createProgramAction(input: ProgramInput): Promise<ActionResult<{ id: string }>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  const supabase = sb!

  const v = validate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const { data, error } = await (supabase as any)
    .from('offline_programs')
    .insert(v.value)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 슬러그입니다.' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/offline/programs')
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function updateProgramAction(id: string, input: ProgramInput): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }
  const supabase = sb!

  const v = validate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const { error } = await (supabase as any)
    .from('offline_programs')
    .update(v.value)
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 사용 중인 슬러그입니다.' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/offline/programs')
  revalidatePath(`/admin/offline/programs/${id}`)
  return { ok: true, data: null }
}

/** soft delete — deleted_at = now() */
export async function deleteProgramAction(id: string): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }
  const supabase = sb!

  const { error } = await (supabase as any)
    .from('offline_programs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/offline/programs')
  return { ok: true, data: null }
}
