'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  sessionId: string
  /** 본인이 이미 대기 신청 중인 row id (있으면 "대기 취소" 모드) */
  existingWaitlistId: string | null
  /** 비로그인 시 redirect 받을 URL */
  redirectTo: string
  isLoggedIn: boolean
}

export function WaitlistButton({ sessionId, existingWaitlistId, redirectTo, isLoggedIn }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/offline/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, attendee_count: 1 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `대기 신청 실패 (HTTP ${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '대기 신청 중 오류')
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!existingWaitlistId) return
    if (!confirm('대기 신청을 취소하시겠습니까?')) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/offline/waitlist/${existingWaitlistId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `대기 취소 실패 (HTTP ${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '대기 취소 중 오류')
      setSubmitting(false)
    }
  }

  if (existingWaitlistId) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" /> 대기 신청 중
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {submitting ? '...' : '대기 취소'}
        </button>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleApply}
        disabled={submitting}
        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
        {submitting ? '...' : '대기 신청'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
