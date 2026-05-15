'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react'

/**
 * Admin route group 전역 error boundary.
 * Next.js 가 server / client error 를 catch 해서 이 컴포넌트로 fallback.
 *
 * 상위 layout.tsx 의 RLS 가드 (admin / superadmin) 는 정상 작동 — 여기는
 * 그 이후 admin 페이지에서 발생한 런타임 에러를 처리.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[AdminLayout Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-navy">관리자 페이지 오류</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도하시거나 운영팀에 문의해주세요.
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-2 max-w-2xl rounded-lg bg-red-50 p-4 text-left text-xs text-red-700 overflow-auto">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
        >
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 hover:border-accent hover:text-accent"
        >
          <LayoutDashboard className="h-4 w-4" /> 대시보드로
        </Link>
      </div>

      {error.digest && (
        <p className="mt-2 text-[11px] text-gray-400">
          오류 코드: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  )
}
