'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function UserProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[UserProfileError]', error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-base font-semibold text-navy">프로필을 불러올 수 없습니다</h2>
      <p className="text-sm text-gray-500">잠시 후 다시 시도해주세요.</p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-2 max-w-xl overflow-auto rounded-lg bg-red-50 p-3 text-left text-xs text-red-700">
          {error.message}
        </pre>
      )}
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/90"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 hover:border-accent hover:text-accent"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
