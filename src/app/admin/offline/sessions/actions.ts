'use server'

/**
 * Server Actions — 오프라인 회차 CRUD.
 * Phase C4 — Route Handlers POST + PUT + DELETE 마이그.
 * (sessions/[id]/days 는 별도 — SessionDaysEditor 가 사용 중, 이번 라운드 제외)
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'
import type { OfflineSessionStatus, OfflineSessionRefundPolicy } from '@/types/database'

const STATUSES: OfflineSessionStatus[] = ['open', 'closed', 'cancelled', 'completed']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface SessionInput {
  program_id?: string  // create 시에만 필수, update 시 무시
  title: string | null
  start_date: string
  end_date: string
  capacity: number
  price: number
  vat_included: boolean
  location_name: string | null
  location_address: string | null
  location_url: string | null
  payment_deadline_days: number | null
  payment_deadline_before_start: number | null
  refund_policy: OfflineSessionRefundPolicy
  status: OfflineSessionStatus
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function validate(input: SessionInput, requireProgramId: boolean): { ok: true; value: SessionInput } | { ok: false; error: string } {
  if (requireProgramId && !input.program_id?.trim()) {
    return { ok: false, error: 'program_id 필수' }
  }
  if (!ISO_DATE_RE.test(input.start_date) || !ISO_DATE_RE.test(input.end_date)) {
    return { ok: false, error: '날짜 형식 오류 (YYYY-MM-DD)' }
  }
  if (input.end_date < input.start_date) return { ok: false, error: '종료일이 시작일보다 빠를 수 없음' }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) return { ok: false, error: '정원은 1 이상 정수' }
  if (!Number.isInteger(input.price) || input.price < 0) return { ok: false, error: '가격은 0 이상 정수' }
  if (!STATUSES.includes(input.status)) return { ok: false, error: '상태 값 오류' }

  if (input.payment_deadline_days !== null && (!Number.isInteger(input.payment_deadline_days) || input.payment_deadline_days < 0)) {
    return { ok: false, error: '결제기한(신청후N일)은 0 이상 정수 또는 null' }
  }
  if (input.payment_deadline_before_start !== null && (!Number.isInteger(input.payment_deadline_before_start) || input.payment_deadline_before_start < 0)) {
    return { ok: false, error: '결제기한(시작N일전)은 0 이상 정수 또는 null' }
  }

  const rp = input.refund_policy
  if (!Number.isInteger(rp.full_refund_days_before) || rp.full_refund_days_before < 0
      || !Number.isInteger(rp.half_refund_days_before) || rp.half_refund_days_before < 0) {
    return { ok: false, error: '환불 정책 값 오류 (0 이상 정수)' }
  }
  if (rp.full_refund_days_before < rp.half_refund_days_before) {
    return { ok: false, error: '100% 환불 기준일이 50% 환불 기준일보다 작을 수 없음' }
  }

  return { ok: true, value: input }
}

export async function createSessionAction(input: SessionInput): Promise<ActionResult<{ id: string }>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  const supabase = sb!

  const v = validate(input, true)
  if (!v.ok) return { ok: false, error: v.error }

  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('id')
    .eq('id', v.value.program_id!)
    .is('deleted_at', null)
    .maybeSingle()
  if (!rawProgram) return { ok: false, error: '존재하지 않거나 삭제된 프로그램입니다.' }

  const { data, error } = await (supabase as any)
    .from('offline_sessions')
    .insert(v.value)
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/offline/sessions')
  if (v.value.program_id) {
    revalidatePath(`/admin/offline/programs/${v.value.program_id}/sessions`)
  }
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function updateSessionAction(id: string, input: SessionInput): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }
  const supabase = sb!

  const v = validate(input, false)
  if (!v.ok) return { ok: false, error: v.error }
  // program_id 변경 차단 — update 시 무시
  const { program_id: _ignored, ...payload } = v.value // eslint-disable-line @typescript-eslint/no-unused-vars

  const { error } = await (supabase as any)
    .from('offline_sessions')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/offline/sessions')
  revalidatePath(`/admin/offline/programs`)
  return { ok: true, data: null }
}

/** soft delete */
export async function deleteSessionAction(id: string): Promise<ActionResult<null>> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }
  const supabase = sb!

  const { error } = await (supabase as any)
    .from('offline_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/offline/sessions')
  return { ok: true, data: null }
}
