'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle, Loader2 } from 'lucide-react'

interface Props {
  enrollmentId: string
  status: 'pending_payment' | 'confirmed'
  preview: {
    rate: 0 | 50 | 100
    amount: number
    paymentMethod: 'card' | 'invoice' | null
  }
}

export function AdminCancelEnrollmentButton({ enrollmentId, status, preview }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    const reason = prompt('취소 사유 (선택, 운영자 메모로 저장):', '')
    if (reason === null) return  // cancel pressed

    let confirmText: string
    if (status === 'pending_payment') {
      confirmText = '결제 대기 중인 신청을 관리자 권한으로 취소합니다. 환불 절차 없이 즉시 취소.'
    } else {
      const rline =
        preview.rate === 0
          ? '환불 불가 (환불 가능 기간 경과)'
          : preview.paymentMethod === 'card'
          ? `${preview.amount.toLocaleString()}원 (${preview.rate}%) 자동 환불`
          : `${preview.amount.toLocaleString()}원 (${preview.rate}%) 환불 — 운영팀이 입금 계좌로 직접 송금`
      confirmText = `정말 신청을 취소하시겠습니까?\n\n환불: ${rline}\n사유: ${reason || '(없음)'}\n\n취소 후 자리 발생 → 대기열 1순위 자동 알림.`
    }

    if (!confirm(confirmText)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `취소 실패 (HTTP ${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '취소 중 오류')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
        {submitting ? '처리 중...' : '관리자 취소'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
