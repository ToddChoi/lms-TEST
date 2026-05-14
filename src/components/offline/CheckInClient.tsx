'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  token: string
}

type Result =
  | { state: 'loading' }
  | {
      state: 'success'
      idempotent?: boolean
      message?: string
      day?: { date: string; day_number: number; topic: string | null }
    }
  | { state: 'error'; error: string }

export function CheckInClient({ token }: Props) {
  const [result, setResult] = useState<Result>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/offline/attendance/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setResult({ state: 'error', error: data.error || `처리 실패 (HTTP ${res.status})` })
          return
        }
        setResult({ state: 'success', ...data })
      } catch (e: any) {
        if (cancelled) return
        setResult({ state: 'error', error: e.message ?? '네트워크 오류' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  if (result.state === 'loading') {
    return (
      <div className="mt-6 flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <p className="text-xs text-gray-500">서버에 출석 기록 중...</p>
      </div>
    )
  }

  if (result.state === 'success') {
    return (
      <div className="mt-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-green-700">
          {result.idempotent ? '이미 출석 체크되어 있습니다' : '출석 완료'}
        </h2>
        {result.day && (
          <p className="mt-2 text-sm text-gray-600">
            {result.day.day_number}일차 · {result.day.date}
            {result.day.topic && ` · ${result.day.topic}`}
          </p>
        )}
        <Link
          href="/my/offline"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-light"
        >
          마이페이지로
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-7 w-7 text-red-600" />
      </div>
      <h2 className="text-lg font-bold text-red-700">출석 체크 실패</h2>
      <p className="mt-2 text-sm text-red-600">{result.error}</p>
      <p className="mt-3 text-xs text-gray-500">
        운영팀에 문의하거나 마이페이지에서 상태를 확인해주세요.
      </p>
      <Link
        href="/my/offline"
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm text-gray-600 hover:bg-silver"
      >
        마이페이지로
      </Link>
    </div>
  )
}
