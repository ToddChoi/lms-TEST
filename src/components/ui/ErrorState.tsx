'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = '문제가 발생했습니다',
  description = '잠시 후 다시 시도해주세요.',
  onRetry,
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 py-12 px-6 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
        <AlertTriangle className="h-5 w-5 text-red-500" />
      </div>
      <p className="text-base font-semibold text-red-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-red-600/80 max-w-sm">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition"
        >
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </button>
      )}
    </div>
  )
}
