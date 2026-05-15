'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[PublicLayout Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold text-navy">페이지를 불러올 수 없습니다</h2>
      <p className="text-sm text-gray-500">
        일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 max-w-xl rounded-lg bg-red-50 p-4 text-left text-xs text-red-700 overflow-auto">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
        </pre>
      )}
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-accent px-5 py-2 text-sm text-white hover:bg-accent/90"
      >
        다시 시도
      </button>
    </div>
  )
}
