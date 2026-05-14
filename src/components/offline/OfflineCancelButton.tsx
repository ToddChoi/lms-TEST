'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle, Loader2 } from 'lucide-react'

interface Props {
  enrollmentId: string
  status: 'pending_payment' | 'confirmed'
  /** UI 표시용 — 실제 환불은 서버에서 다시 계산 */
  preview: {
    rate: 0 | 50 | 100
    amount: number
    paymentMethod: 'card' | 'invoice' | null
  }
}

const RATE_LABEL: Record<0 | 50 | 100, string> = {
  100: '100% 환불 가능',
  50: '50% 환불 가능 (절반 차감)',
  0: '환불 불가 (환불 가능 기간 경과)',
}

export function OfflineCancelButton({ enrollmentId, status, preview }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    let confirmText: string
    if (status === 'pending_payment') {
      confirmText = '결제 대기 중인 신청을 취소하시겠습니까?\n\n결제하지 않은 상태이므로 환불 절차 없이 즉시 취소됩니다.'
    } else {
      const refundLine =
        preview.rate === 0
          ? '환불 불가 (환불 가능 기간 경과)'
          : preview.paymentMethod === 'card'
          ? `${preview.amount.toLocaleString()}원 (${preview.rate}%) 자동 환불 — 영업일 3-7일 소요`
          : `${preview.amount.toLocaleString()}원 (${preview.rate}%) 환불 예정 — 운영팀이 입금 계좌로 직접 송금 (영업일 3-7일)`
      confirmText = `정말 신청을 취소하시겠습니까?\n\n환불: ${refundLine}\n\n취소 후 같은 회차에 재신청은 잔여석이 있을 때만 가능합니다.`
    }

    if (!confirm(confirmText)) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/offline/cancel/${enrollmentId}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `취소 실패 (HTTP ${res.status})`)
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '취소 중 오류')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-gray-500">
        예상 환불: <strong className="text-navy">{RATE_LABEL[preview.rate]}</strong>
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            처리 중...
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4" />
            신청 취소
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
