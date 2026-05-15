'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import { Award, Loader2, CheckCircle2 } from 'lucide-react'
import {
  issueCertificatesAction,
  initialIssueState,
  type IssueState,
} from '@/app/admin/offline/certificates/actions'

interface Props {
  sessions: Array<{ id: string; label: string }>
}

/**
 * Phase B PoC — Server Action + useFormState 패턴.
 *
 * 기존: 'use client' + onSubmit + fetch('/api/...') + setState  (SPA / React 스타일)
 * 이후: 'use client' (form 상태 hook 위해 유지) + form action={action} + useFormState
 *
 * 차이:
 *   - fetch JSON parse 코드 제거 → action 이 state 직접 반환
 *   - revalidatePath 가 router.refresh() 대체
 *   - useFormStatus 가 pending 자동 추적 → submitting state 직접 관리 X
 *   - 비-JS 환경에서도 폼 제출 가능 (progressive enhancement)
 *
 * confirm() 패턴: <form onSubmit={...preventDefault}> 으로 action 차단.
 *   onSubmit 이 action 보다 먼저 실행됨 → preventDefault 시 action 미발화.
 */

export function IssueCertificatesForm({ sessions }: Props) {
  const [sessionId, setSessionId] = useState('')
  const [force, setForce] = useState(false)
  const [state, formAction] = useFormState<IssueState, FormData>(
    issueCertificatesAction,
    initialIssueState,
  )

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    if (!sessionId) {
      e.preventDefault()
      alert('회차를 선택해주세요.')
      return
    }
    const ok = confirm(
      `선택한 회차의 수료 가능자에게 일괄 발급합니다.${force ? ' (출석률 기준 무시 — 강제 발급)' : ''}\n\n진행하시겠습니까?`
    )
    if (!ok) e.preventDefault()
  }

  return (
    <form action={formAction} onSubmit={handleConfirm} className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (state.issued > 0 || state.skipped_existing > 0 || state.skipped_low_rate > 0) && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> 발급 완료
          </div>
          <ul className="mt-2 space-y-0.5 text-xs">
            <li>발급: <strong>{state.issued}건</strong></li>
            <li>이미 발급됨 (skip): {state.skipped_existing}건</li>
            <li>출석률 미달 (skip): {state.skipped_low_rate}건</li>
            {state.errors.length > 0 && (
              <li className="text-red-600">
                오류 {state.errors.length}건:
                <ul className="ml-4 mt-1 list-disc space-y-0.5">
                  {state.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                  {state.errors.length > 5 && <li>... 외 {state.errors.length - 5}건</li>}
                </ul>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <select
          name="session_id"
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
        <SubmitButton disabled={!sessionId} />
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          name="force"
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

/** useFormStatus — form action 의 pending state 자동 추적 (별도 useState 불필요). */
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
      {pending ? '발급 중...' : '일괄 발급'}
    </button>
  )
}
