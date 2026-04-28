import Link from 'next/link'
import { Inbox, type LucideIcon } from 'lucide-react'

interface Action {
  label: string
  href?: string
  onClick?: () => void
}

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  action?: Action
  className?: string
}

/**
 * 목록·테이블 등에서 데이터가 0건일 때 노출하는 공통 컴포넌트.
 *
 * 사용 예:
 *   <EmptyState
 *     title="아직 등록된 강좌가 없습니다"
 *     description="첫 강좌를 만들어 학생들과 만나보세요"
 *     action={{ label: '강좌 만들기', href: '/admin/courses/new' }}
 *   />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: Props) {
  const ActionEl = action?.href ? (
    <Link
      href={action.href}
      className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#0B1F3A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#162d4f] transition"
    >
      {action.label}
    </Link>
  ) : action?.onClick ? (
    <button
      onClick={action.onClick}
      className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#0B1F3A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#162d4f] transition"
    >
      {action.label}
    </button>
  ) : null

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl bg-white py-16 px-6 text-center shadow-sm border border-gray-100 ${className}`}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F6FA]">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-base font-semibold text-[#0B1F3A]">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-gray-500 max-w-sm">{description}</p>
      )}
      {ActionEl}
    </div>
  )
}
