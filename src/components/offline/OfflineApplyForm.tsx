'use client'

import { useState } from 'react'
import { CreditCard, Receipt, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  sessionId: string
  totalAmount: number
  vatIncluded: boolean
  applicantName: string
  applicantEmail: string
}

type PaymentMethod = 'card' | 'invoice'

export function OfflineApplyForm({
  sessionId,
  totalAmount,
  vatIncluded,
  applicantName,
  applicantEmail,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('환불 정책 및 안내 사항에 동의해주세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/offline/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, payment_method: method }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `신청 실패 (HTTP ${res.status})`)
      }
      if (data.url) {
        // Stripe Checkout 으로 이동
        window.location.href = data.url
        return
      }
      throw new Error('결제 URL 을 받지 못했습니다.')
    } catch (e: any) {
      setError(e.message ?? '신청 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">신청자 정보</h2>
        <div className="flex flex-col gap-2 text-sm text-gray-700">
          <div className="flex">
            <span className="w-20 shrink-0 text-gray-500">이름</span>
            <span className="font-medium text-navy">{applicantName || '(이름 없음)'}</span>
          </div>
          <div className="flex">
            <span className="w-20 shrink-0 text-gray-500">이메일</span>
            <span className="font-medium text-navy">{applicantEmail}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          정보 수정은 <a href="/my/profile" className="text-accent hover:underline">마이페이지</a> 에서.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">결제 방식</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-xl border p-4 transition ${
              method === 'card'
                ? 'border-accent bg-accent-pale/40'
                : 'border-gray-200 bg-white hover:border-accent/40'
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              checked={method === 'card'}
              onChange={() => setMethod('card')}
              className="h-4 w-4 accent-accent"
            />
            <CreditCard className="h-5 w-5 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-navy">카드 결제</p>
              <p className="text-[11px] text-gray-500">Stripe — 즉시 결제 후 자리 확정</p>
            </div>
          </label>
          <label
            className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 opacity-60"
            title="세금계산서 결제는 곧 오픈됩니다."
          >
            <input type="radio" disabled className="h-4 w-4" />
            <Receipt className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">세금계산서 (준비 중)</p>
              <p className="text-[11px] text-gray-400">기업 단체 신청 — Phase 3 오픈 예정</p>
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">결제 금액</h2>
        <div className="flex items-baseline justify-between border-t border-gray-100 pt-3 text-navy">
          <span className="text-sm font-medium">총 결제 금액</span>
          <span className="text-xl font-bold">
            {totalAmount.toLocaleString()}원
            {!vatIncluded && (
              <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
            )}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-amber-50 p-5">
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <strong>환불 정책 및 안내 사항에 동의합니다.</strong>
            <br />
            <span className="text-xs text-gray-600">
              · 강좌 시작 7일 전까지 100% 환불, 3~6일 전 50%, 2일 이내 환불 불가 (회차별 정책 우선).
              <br />
              · 정원 초과 발생 시 자동 환불 처리됩니다.
              <br />
              · 결제 완료 후 자리 확정. 자세한 일정은 마이페이지에서 확인 가능.
            </span>
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={submitting || !agreed}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            결제 페이지로 이동 중...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {totalAmount.toLocaleString()}원 결제하고 신청 완료
          </>
        )}
      </button>
    </form>
  )
}
