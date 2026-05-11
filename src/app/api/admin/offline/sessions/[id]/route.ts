import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_guard'
import type { OfflineSessionStatus, OfflineSessionRefundPolicy } from '@/types/database'

const STATUSES: OfflineSessionStatus[] = ['open', 'closed', 'cancelled', 'completed']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface SessionUpdate {
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

function validate(body: unknown): { ok: true; value: SessionUpdate } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' }
  const b = body as Record<string, unknown>

  const start_date = String(b.start_date ?? '')
  const end_date = String(b.end_date ?? '')
  if (!ISO_DATE_RE.test(start_date) || !ISO_DATE_RE.test(end_date)) {
    return { ok: false, error: '날짜 형식 오류 (YYYY-MM-DD)' }
  }
  if (end_date < start_date) return { ok: false, error: '종료일이 시작일보다 빠를 수 없음' }
  const capacity = Number(b.capacity)
  if (!Number.isInteger(capacity) || capacity < 1) return { ok: false, error: '정원은 1 이상 정수' }
  const price = Number(b.price)
  if (!Number.isInteger(price) || price < 0) return { ok: false, error: '가격은 0 이상 정수' }
  const status = b.status as OfflineSessionStatus
  if (!STATUSES.includes(status)) return { ok: false, error: '상태 값 오류' }

  const optInt = (v: unknown, label: string): number | null | string => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0) return `${label}은 0 이상 정수 또는 null`
    return n
  }
  const pdDays = optInt(b.payment_deadline_days, '결제기한(신청후N일)')
  if (typeof pdDays === 'string') return { ok: false, error: pdDays }
  const pdBefore = optInt(b.payment_deadline_before_start, '결제기한(시작N일전)')
  if (typeof pdBefore === 'string') return { ok: false, error: pdBefore }

  const rp = b.refund_policy as Partial<OfflineSessionRefundPolicy> | undefined
  const fullDays = Number(rp?.full_refund_days_before)
  const halfDays = Number(rp?.half_refund_days_before)
  if (!Number.isInteger(fullDays) || fullDays < 0 || !Number.isInteger(halfDays) || halfDays < 0) {
    return { ok: false, error: '환불 정책 값 오류' }
  }
  if (fullDays < halfDays) return { ok: false, error: '100% 환불 기준일이 50% 환불 기준일보다 작을 수 없음' }

  return {
    ok: true,
    value: {
      title: b.title ? String(b.title) : null,
      start_date,
      end_date,
      capacity,
      price,
      vat_included: b.vat_included !== false,
      location_name: b.location_name ? String(b.location_name) : null,
      location_address: b.location_address ? String(b.location_address) : null,
      location_url: b.location_url ? String(b.location_url) : null,
      payment_deadline_days: pdDays,
      payment_deadline_before_start: pdBefore,
      refund_policy: {
        full_refund_days_before: fullDays,
        half_refund_days_before: halfDays,
      },
      status,
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
    .from('offline_sessions')
    .update(v.value)
    .eq('id', params.id)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// 소프트 삭제 — deleted_at = now()
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { error } = await (supabase as any)
    .from('offline_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('deleted_at', null)

  if (error) {
    // ON DELETE RESTRICT 위반 시 (신청자 있는 회차) — soft delete 자체는 OK 지만
    // 운영자 의도와 다를 수 있어 강제 차단 X (PRD 검토 후 추가 정책 가능)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
