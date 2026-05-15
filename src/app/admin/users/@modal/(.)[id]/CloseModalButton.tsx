'use client'

import { useRouter } from 'next/navigation'

/**
 * Modal 닫기 — router.back() 으로 이전 URL (/admin/users 목록) 복귀.
 * Parallel slot 이 default.tsx (null) 로 fallback → modal 사라짐.
 *
 * server component 모달에서 onClick 가 필요한 부분만 client 로 분리.
 */
export function CloseModalButton({
  className,
  children,
  'aria-label': ariaLabel,
}: {
  className?: string
  children?: React.ReactNode
  'aria-label'?: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}
