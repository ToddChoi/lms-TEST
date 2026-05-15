'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function MyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[MyPageError]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-navy">마이페이지 오류</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          학습 정보를 불러오는 중 문제가 발생했습니다.
        </p>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-2 max-w-2xl overflow-auto rounded-lg bg-red-50 p-4 text-left text-xs text-red-700">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
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
          href="/my"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 hover:border-accent hover:text-accent"
        >
          마이페이지 홈
        </Link>
      </div>
    </div>
  )
}
