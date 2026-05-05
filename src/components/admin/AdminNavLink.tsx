'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

/**
 * Linear/Notion 톤 사이드바 링크.
 *  - 비활성: 옅은 회색 + 호버 시 옅은 배경
 *  - 활성:   accent 색 + 좌측 4px 인디케이터
 */
export function AdminNavLink({ href, label, icon, exact }: Props) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-120 ease-out-snap ${
        isActive
          ? 'bg-accent-pale text-accent'
          : 'text-gray-600 hover:bg-surface-muted hover:text-navy'
      }`}
    >
      {/* 활성 좌측 인디케이터 */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
        />
      )}
      <span className={`shrink-0 ${isActive ? 'text-accent' : 'text-gray-500 group-hover:text-navy'}`}>
        {icon}
      </span>
      {label}
    </Link>
  )
}
