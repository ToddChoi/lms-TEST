/**
 * Ingrow 로고 — 자체 SVG 모노그램.
 *
 * 컨셉: "in-grow" — 안쪽으로 자라나는 화살표.
 * 작게는 favicon 처럼, 크게는 hero 헤딩처럼 사용 가능.
 *
 * 사용:
 *   <Logo />                    // 가로 워드마크 (기본)
 *   <Logo variant="mark" />     // 정사각형 마크만 (favicon 용)
 *   <Logo variant="full" size="lg" />
 *
 * 색상은 currentColor 기반 — 부모의 text-* 가 결정.
 *   <span className="text-navy"><Logo /></span>
 *   <span className="text-white"><Logo /></span>
 */
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'full' | 'mark'   // 워드마크 포함 / 마크만
  size?: 'sm' | 'md' | 'lg'   // 24 / 32 / 48px 마크 기준
  className?: string
  showText?: boolean          // full 일 때 텍스트 노출 여부 (기본 true)
}

const SIZE = { sm: 24, md: 32, lg: 48 } as const

export function Logo({ variant = 'full', size = 'md', className, showText = true }: Props) {
  const px = SIZE[size]

  const Mark = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* 둥근 사각 배경 — currentColor 의 옅은 변형 */}
      <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.08" />
      {/* "i" 의 점 */}
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
      {/* "i" 의 줄기 */}
      <rect x="7.6" y="13.2" width="2.8" height="11.5" rx="1.4" fill="currentColor" />
      {/* "g" — 안쪽으로 자라나는 화살표 형상 */}
      <path
        d="M16 13.2 L16 24.7 M16 19 L22 19 C23.4 19 24.5 17.9 24.5 16.5 L24.5 13.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 화살촉 — 안쪽 방향 */}
      <path
        d="M21.5 16.2 L24.5 13.2 L21.5 10.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )

  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}>{Mark}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {Mark}
      {showText && (
        <span className="font-bold tracking-tight" style={{ fontSize: px * 0.6 }}>
          Ingrow
        </span>
      )}
    </span>
  )
}
