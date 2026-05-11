'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  OFFLINE_SESSION_STATUS_LABEL,
  type OfflineSession,
  type OfflineSessionStatus,
} from '@/types/database'
import { Save, Trash2 } from 'lucide-react'

interface Props {
  programId: string
  /** 편집 모드면 기존 회차, 신규면 undefined */
  initial?: OfflineSession
}

interface FormState {
  title: string
  start_date: string
  end_date: string
  capacity: number
  price: number
  vat_included: boolean
  location_name: string
  location_address: string
  location_url: string
  // null 허용 — 빈 문자열 → null 변환
  payment_deadline_days: string
  payment_deadline_before_start: string
  refund_full_days: number
  refund_half_days: number
  status: OfflineSessionStatus
}

function fromInitial(s: OfflineSession | undefined): FormState {
  return {
    title: s?.title ?? '',
    start_date: s?.start_date ?? '',
    end_date: s?.end_date ?? '',
    capacity: s?.capacity ?? 20,
    price: s?.price ?? 0,
    vat_included: s?.vat_included ?? true,
    location_name: s?.location_name ?? '',
    location_address: s?.location_address ?? '',
    location_url: s?.location_url ?? '',
    payment_deadline_days:
      s?.payment_deadline_days != null ? String(s.payment_deadline_days) : '',
    payment_deadline_before_start:
      s?.payment_deadline_before_start != null ? String(s.payment_deadline_before_start) : '',
    refund_full_days: s?.refund_policy?.full_refund_days_before ?? 7,
    refund_half_days: s?.refund_policy?.half_refund_days_before ?? 3,
    status: s?.status ?? 'open',
  }
}

export function SessionForm({ programId, initial }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(fromInitial(initial))
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!initial

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.start_date || !form.end_date) {
      setError('시작일 / 종료일은 필수입니다.')
      return
    }
    if (form.end_date < form.start_date) {
      setError('종료일이 시작일보다 빠를 수 없습니다.')
      return
    }
    if (form.capacity < 1) {
      setError('정원은 1 이상이어야 합니다.')
      return
    }
    if (form.price < 0) {
      setError('가격은 0 이상이어야 합니다.')
      return
    }

    const optInt = (v: string): number | null => {
      if (v.trim() === '') return null
      const n = Number(v)
      return Number.isInteger(n) && n >= 0 ? n : NaN
    }
    const pdDays = optInt(form.payment_deadline_days)
    const pdBefore = optInt(form.payment_deadline_before_start)
    if (Number.isNaN(pdDays) || Number.isNaN(pdBefore)) {
      setError('결제 기한은 0 이상 정수 또는 빈 값(글로벌 사용).')
      return
    }
    if (form.refund_full_days < 0 || form.refund_half_days < 0) {
      setError('환불 기준일은 0 이상 정수.')
      return
    }
    if (form.refund_full_days < form.refund_half_days) {
      setError('100% 환불 기준일이 50% 환불 기준일보다 작을 수 없습니다.')
      return
    }

    setSubmitting(true)
    try {
      const body = {
        program_id: programId,
        title: form.title.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
        capacity: form.capacity,
        price: form.price,
        vat_included: form.vat_included,
        location_name: form.location_name.trim() || null,
        location_address: form.location_address.trim() || null,
        location_url: form.location_url.trim() || null,
        payment_deadline_days: pdDays,
        payment_deadline_before_start: pdBefore,
        refund_policy: {
          full_refund_days_before: form.refund_full_days,
          half_refund_days_before: form.refund_half_days,
        },
        status: form.status,
      }
      const res = await fetch(
        isEdit
          ? `/api/admin/offline/sessions/${initial!.id}`
          : '/api/admin/offline/sessions',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `요청 실패 (HTTP ${res.status})`)
      }
      const j = await res.json().catch(() => ({}))
      if (!isEdit && j.id) {
        // 새로 생성된 회차의 편집 페이지 (회차 일자 추가 시작)로 바로 이동
        router.push(`/admin/offline/programs/${programId}/sessions/${j.id}`)
      } else {
        router.push(`/admin/offline/programs/${programId}/sessions`)
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    if (!confirm('이 회차를 삭제하시겠습니까?\n\n(소프트 삭제 — 관련 데이터는 유지됨)')) {
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/sessions/${initial!.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `삭제 실패 (HTTP ${res.status})`)
      }
      router.push(`/admin/offline/programs/${programId}/sessions`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '삭제 중 오류가 발생했습니다.')
      setDeleting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-gray-50'
  const labelClass = 'block mb-1.5 text-xs font-semibold text-gray-600'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">기본 정보</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>회차 제목 (선택)</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder='예: "1기" / "10월차" / "2026 신년 워크샵"'
            />
          </div>
          <div>
            <label className={labelClass}>시작일 *</label>
            <input
              type="date"
              className={inputClass}
              value={form.start_date}
              onChange={(e) => {
                update('start_date', e.target.value)
                if (!form.end_date || form.end_date < e.target.value) {
                  update('end_date', e.target.value)
                }
              }}
              required
            />
          </div>
          <div>
            <label className={labelClass}>종료일 * (단발이면 시작일과 동일)</label>
            <input
              type="date"
              className={inputClass}
              value={form.end_date}
              onChange={(e) => update('end_date', e.target.value)}
              min={form.start_date}
              required
            />
          </div>
          <div>
            <label className={labelClass}>정원 *</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.capacity}
              onChange={(e) => update('capacity', Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>상태 *</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value as OfflineSessionStatus)}
            >
              {(Object.keys(OFFLINE_SESSION_STATUS_LABEL) as OfflineSessionStatus[]).map((s) => (
                <option key={s} value={s}>{OFFLINE_SESSION_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">가격</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>가격 (원) *</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.price}
              onChange={(e) => update('price', Number(e.target.value))}
              required
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={form.vat_included}
                onChange={(e) => update('vat_included', e.target.checked)}
              />
              VAT 포함 가격 (체크 해제 시 별도 표기)
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">장소</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>장소명</label>
            <input
              className={inputClass}
              value={form.location_name}
              onChange={(e) => update('location_name', e.target.value)}
              placeholder="예: 강남 본사 5층 교육장"
            />
          </div>
          <div>
            <label className={labelClass}>지도 링크</label>
            <input
              className={inputClass}
              value={form.location_url}
              onChange={(e) => update('location_url', e.target.value)}
              placeholder="https://map.naver.com/..."
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>주소</label>
            <input
              className={inputClass}
              value={form.location_address}
              onChange={(e) => update('location_address', e.target.value)}
              placeholder="예: 서울 강남구 테헤란로 123, 5층"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">결제 / 환불 정책 (회차 오버라이드)</h2>
        <p className="mb-3 text-xs text-gray-500">
          빈 값 = 글로벌 사이트 설정 사용. 입력 시 이 회차에만 적용 (신청 시점에 enrollment 로 스냅샷).
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>결제 기한 (신청 후 N일)</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.payment_deadline_days}
              onChange={(e) => update('payment_deadline_days', e.target.value)}
              placeholder="(글로벌 사용)"
            />
          </div>
          <div>
            <label className={labelClass}>결제 기한 (강좌 시작 N일 전)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.payment_deadline_before_start}
              onChange={(e) => update('payment_deadline_before_start', e.target.value)}
              placeholder="(글로벌 사용)"
            />
          </div>
          <div>
            <label className={labelClass}>100% 환불 기준 (시작 N일 전)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.refund_full_days}
              onChange={(e) => update('refund_full_days', Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className={labelClass}>50% 환불 기준 (시작 N일 전)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.refund_half_days}
              onChange={(e) => update('refund_half_days', Number(e.target.value))}
              required
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || deleting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? '삭제 중...' : '회차 삭제'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-silver"
            disabled={submitting || deleting}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || deleting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting ? '저장 중...' : isEdit ? '저장' : '생성'}
          </button>
        </div>
      </div>
    </form>
  )
}
