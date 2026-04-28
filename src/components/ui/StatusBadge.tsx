import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'open' | 'closed' | 'draft' | 'active' | 'completed' | 'expired'
  className?: string
}

const statusConfig = {
  open: { label: '신청중', className: 'bg-green-100 text-green-700' },
  active: { label: '신청중', className: 'bg-green-100 text-green-700' },
  closed: { label: '신청마감', className: 'bg-gray-100 text-gray-600' },
  draft: { label: '준비중', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '수료완료', className: 'bg-accent-pale text-accent' },
  expired: { label: '기간만료', className: 'bg-red-100 text-red-600' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
