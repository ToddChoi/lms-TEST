'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'

interface Props {
  enrollmentId: string
  attendeeId: string
  attendeeName: string
}

export function AdminCancelAttendeeButton({ enrollmentId, attendeeId, attendeeName }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm(`참석자 "${attendeeName}" 의 신청을 취소하시겠습니까?\n\n환불 정책에 따라 1인분 환불액 자동 계산.\n강좌 시작 후엔 취소 불가.`)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/offline/enrollments/${enrollmentId}/attendees/${attendeeId}/cancel`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `취소 실패 (HTTP ${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '취소 중 오류')
      setSubmitting(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="inline-flex items-center gap-0.5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        title={`${attendeeName} 취소`}
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </button>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
