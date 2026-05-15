'use server'

/**
 * Server Action — 오프라인 설정 저장.
 * Phase C — Route Handler PUT /api/admin/offline/settings 마이그.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'

const ALLOWED_KEYS = new Set([
  'offline_payment_deadline_days',
  'offline_payment_deadline_before_start',
  'offline_refund_full_days',
  'offline_refund_half_days',
  'offline_waitlist_grace_hours',
  'offline_qr_window_minutes',
  'offline_pre_event_notice_days',
  'offline_bank_account',
  'offline_invoice_company_info',
])

const NUMERIC_KEYS = new Set([
  'offline_payment_deadline_days',
  'offline_payment_deadline_before_start',
  'offline_refund_full_days',
  'offline_refund_half_days',
  'offline_waitlist_grace_hours',
  'offline_qr_window_minutes',
  'offline_pre_event_notice_days',
])

export interface SettingsState {
  ok: boolean
  updated: number
  error: string | null
  /** ISO timestamp — UI 의 "방금 저장됨" 표시용. */
  savedAt: string | null
}

export const initialSettingsState: SettingsState = {
  ok: false,
  updated: 0,
  error: null,
  savedAt: null,
}

export async function saveOfflineSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return { ...initialSettingsState, error: '권한이 없습니다.' }
  const supabase = sb!

  // formData entries → values record. ALLOWED_KEYS 만 받음.
  const values: Record<string, string> = {}
  for (const key of ALLOWED_KEYS) {
    const v = formData.get(key)
    if (typeof v === 'string') values[key] = v
  }

  // 검증
  for (const [key, raw] of Object.entries(values)) {
    if (NUMERIC_KEYS.has(key)) {
      const v = raw.trim()
      if (v === '') continue
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) {
        return { ...initialSettingsState, error: `${key}: 0 이상 정수만 가능합니다.` }
      }
    }
  }

  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value.trim(),
  }))

  if (rows.length === 0) {
    return { ok: true, updated: 0, error: null, savedAt: new Date().toISOString() }
  }

  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return { ...initialSettingsState, error: error.message }

  revalidatePath('/admin/offline/settings')
  return {
    ok: true,
    updated: rows.length,
    error: null,
    savedAt: new Date().toISOString(),
  }
}
