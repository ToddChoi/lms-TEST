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
      className={`flex flex-col items-center justify-center rounded-lg border border-danger-border bg-danger-soft/40 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-danger-soft">
        <AlertTriangle className="h-5 w-5 text-danger" />
      </div>
      <p className="text-body font-semibold text-danger">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-body-sm text-danger/80">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-danger px-4 py-2 text-body-sm font-medium text-white transition-colors duration-180 ease-out-snap hover:bg-danger/90"
        >
          <RefreshCw className="h-4 w-4" /> 다시 시도
        </button>
      )}
    </div>
  )
}
