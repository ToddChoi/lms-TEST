'use server'

/**
 * Server Actions — 협약기업 CRUD.
 * Phase C2 — Route Handler /api/admin/companies (POST/PATCH/DELETE) 마이그.
 *
 * 패턴: react-hook-form 통합 — handleSubmit (client validation) → useTransition →
 *      action 직접 호출. useFormState 안 씀 (form action 대신 imperative 호출).
 *      → react-hook-form 의 zodResolver + 에러 표시 그대로 유지.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'

export interface CompanyInput {
  name: string
  contact_name?: string | null
  contact_email?: string | null
  contract_start?: string | null
  contract_end?: string | null
  is_active?: boolean
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function createCompanyAction(
  input: CompanyInput,
): Promise<ActionResult<{ id: string }>> {
  const { guard, supabase } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }

  if (!input.name?.trim()) {
    return { ok: false, error: '기업명은 필수입니다.' }
  }

  const { data, error } = await (supabase as any)
    .from('companies')
    .insert({
      name: input.name,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      contract_start: input.contract_start || null,
      contract_end: input.contract_end || null,
      is_active: input.is_active ?? true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/companies')
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function updateCompanyAction(
  id: string,
  input: CompanyInput,
): Promise<ActionResult<null>> {
  const { guard, supabase } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }

  const { error } = await (supabase as any)
    .from('companies')
    .update({
      name: input.name,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      contract_start: input.contract_start || null,
      contract_end: input.contract_end || null,
      is_active: input.is_active ?? true,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${id}`)
  return { ok: true, data: null }
}

export async function deleteCompanyAction(
  id: string,
): Promise<ActionResult<null>> {
  const { guard, supabase } = await requireAdmin()
  if (guard) return { ok: false, error: '권한이 없습니다.' }
  if (!id) return { ok: false, error: 'id 누락' }

  const { error } = await (supabase as any)
    .from('companies')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/companies')
  return { ok: true, data: null }
}
