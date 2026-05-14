import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

interface PutBody {
  values?: Record<string, string>
}

export async function PUT(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = (await req.json().catch(() => ({}))) as PutBody
  const values = body.values ?? {}

  // 검증 — allowed key + numeric 정수 검사
  for (const key of Object.keys(values)) {
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: `허용되지 않는 설정 키: ${key}` }, { status: 400 })
    }
    if (NUMERIC_KEYS.has(key)) {
      const v = values[key].trim()
      if (v === '') continue
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: `${key}: 0 이상 정수만 가능합니다.` },
          { status: 400 }
        )
      }
    }
  }

  // upsert (key 단위) — site_settings 의 PK 가 key. 멱등.
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value.trim(),
  }))

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: rows.length })
}
