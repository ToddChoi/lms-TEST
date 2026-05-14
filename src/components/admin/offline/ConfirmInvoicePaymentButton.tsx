'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  enrollmentId: string
  amount: number
}

/**
 * 세금계산서 결제 입금 확인 버튼.
 * pending_payment + invoice 인 enrollment 만 표시 — 클릭 시 confirmed 전이.
 *
 * 트리거 측 동작:
 *   - DB 트리거: validate_enrollment_status_transition (pending → confirmed 허용)
 *   - DB 트리거: log_enrollment_changes → audit_log 자동 기록
 *   - API: payment_confirmed 메일 + offline_notifications INSERT
 */
export function ConfirmInvoicePaymentButton({ enrollmentId, amount }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm(`이 신청의 입금을 확인하시겠습니까?\n\n금액: ${amount.toLocaleString()}원\n\n확인 시:\n - 즉시 자리 확정 (confirmed)\n - 신청자에게 자리 확정 메일 자동 발송\n - 정원 초과 시 자동 환불 처리`)) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/enrollments/${enrollmentId}/confirm-payment`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `처리 실패 (HTTP ${res.status})`)
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '처리 중 오류')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            처리 중...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            입금 확인 → 자리 확정
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
