'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'

interface Props {
  initial: Record<string, string>
}

interface FieldDef {
  key: string
  label: string
  type: 'number' | 'text' | 'textarea'
  unit?: string
  hint?: string
  placeholder?: string
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: '결제 기한',
    fields: [
      {
        key: 'offline_payment_deadline_days',
        label: '신청 후 N일',
        type: 'number',
        unit: '일',
        hint: '신청 시점부터 N일 안에 결제 안 하면 자동 취소.',
      },
      {
        key: 'offline_payment_deadline_before_start',
        label: '강좌 시작 N일 전',
        type: 'number',
        unit: '일 전',
        hint: '강좌 시작일 기준 N일 전까지 결제 마감. 위 두 기한 중 더 빠른 쪽 적용.',
      },
    ],
  },
  {
    title: '환불 정책',
    fields: [
      {
        key: 'offline_refund_full_days',
        label: '100% 환불 (강좌 시작 N일 전까지)',
        type: 'number',
        unit: '일 전',
      },
      {
        key: 'offline_refund_half_days',
        label: '50% 환불 (강좌 시작 N일 전까지)',
        type: 'number',
        unit: '일 전',
        hint: '100% 환불 기준일과 50% 환불 기준일 사이 = 50%, 그 이후 = 0%.',
      },
    ],
  },
  {
    title: '대기열 / QR / 사전 안내',
    fields: [
      {
        key: 'offline_waitlist_grace_hours',
        label: '대기열 결제 기한 (자리 발생 알림 후 N시간)',
        type: 'number',
        unit: '시간',
      },
      {
        key: 'offline_qr_window_minutes',
        label: 'QR 활성화 시간 (회차 일자 시작 전/후 N분)',
        type: 'number',
        unit: '분',
        hint: '회차 일자 시작 시각 ± N분 동안만 QR 출석 체크 가능.',
      },
      {
        key: 'offline_pre_event_notice_days',
        label: '사전 안내 메일 (강좌 시작 N일 전)',
        type: 'number',
        unit: '일 전',
      },
    ],
  },
  {
    title: '세금계산서 결제',
    fields: [
      {
        key: 'offline_bank_account',
        label: '입금 계좌 정보',
        type: 'textarea',
        hint: '신청자에게 표시될 입금 안내. 예: "신한은행 110-123-456789 (예금주: 인그로우)"',
        placeholder: '신한은행 110-123-456789\n예금주: 인그로우 주식회사',
      },
      {
        key: 'offline_invoice_company_info',
        label: '세금계산서 발행 정보 (JSON)',
        type: 'textarea',
        hint: '사업자등록번호 / 대표자명 / 주소 등. 향후 자동 발행 연동 시 활용.',
        placeholder: '{"business_number":"123-45-67890","ceo":"홍길동"}',
      },
    ],
  },
]

export function OfflineSettingsForm({ initial }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }))
    setSavedAt(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/offline/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `저장 실패 (HTTP ${res.status})`)
      }
      setSavedAt(new Date().toLocaleTimeString('ko-KR'))
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-navy">{section.title}</h2>
          <div className="flex flex-col gap-4">
            {section.fields.map((field) => {
              const value = values[field.key] ?? ''
              return (
                <div key={field.key}>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                    {field.label}
                    {field.unit && <span className="ml-1 text-gray-400">({field.unit})</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
                      rows={4}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => update(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={field.type}
                      className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => update(field.key, e.target.value)}
                      min={field.type === 'number' ? 0 : undefined}
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1 text-[11px] text-gray-500">{field.hint}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-end gap-3">
        {savedAt && (
          <p className="text-xs text-green-600">{savedAt} 저장됨 ✓</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
