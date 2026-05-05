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
  const actionCls =
    'mt-5 inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-body-sm font-medium text-white transition-colors duration-180 ease-out-snap hover:bg-navy-mid'

  const ActionEl = action?.href ? (
    <Link href={action.href} className={actionCls}>
      {action.label}
    </Link>
  ) : action?.onClick ? (
    <button onClick={action.onClick} className={actionCls}>
      {action.label}
    </button>
  ) : null

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface px-6 py-16 text-center shadow-elev-1 ${className}`}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-surface-muted">
        <Icon className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-body font-semibold text-navy">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-sm text-gray-500">{description}</p>
      )}
      {ActionEl}
    </div>
  )
}
