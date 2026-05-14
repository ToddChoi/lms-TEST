'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  sessions: Array<{ id: string; label: string }>
}

export function IssueCertificatesForm({ sessions }: Props) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState('')
  const [force, setForce] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    issued: number
    skipped_existing: number
    skipped_low_rate: number
    errors: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionId) {
      setError('회차를 선택해주세요.')
      return
    }
    if (!confirm(`선택한 회차의 수료 가능자에게 일괄 발급합니다.${force ? ' (출석률 기준 무시 — 강제 발급)' : ''}\n\n진행하시겠습니까?`)) return

    setError(null)
    setResult(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/offline/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `발급 실패 (HTTP ${res.status})`)
      setResult(data)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '처리 중 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> 발급 완료
          </div>
          <ul className="mt-2 space-y-0.5 text-xs">
            <li>발급: <strong>{result.issued}건</strong></li>
            <li>이미 발급됨 (skip): {result.skipped_existing}건</li>
            <li>출석률 미달 (skip): {result.skipped_low_rate}건</li>
            {result.errors.length > 0 && (
              <li className="text-red-600">
                오류 {result.errors.length}건:
                <ul className="ml-4 mt-1 list-disc space-y-0.5">
                  {result.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                  {result.errors.length > 5 && <li>... 외 {result.errors.length - 5}건</li>}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          required
        >
          <option value="">— 종료된 회차 선택 —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !sessionId}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
          {submitting ? '발급 중...' : '일괄 발급'}
        </button>
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        출석률 기준 무시 (강제 발급) — 일반적으로 사용 X
      </label>
      <p className="text-[11px] text-gray-500">
        💡 종료된 회차만 표시. 이미 발급된 사람은 자동 skip.
        출석률 기준은 프로그램의 <code>completion_attendance_rate</code> 값.
      </p>
    </form>
  )
}
