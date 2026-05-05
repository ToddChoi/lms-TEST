import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'open' | 'closed' | 'draft' | 'active' | 'completed' | 'expired'
  className?: string
}

// semantic 토큰 듀오톤 — Phase 3 정리.
const statusConfig = {
  open:      { label: '신청중',   className: 'bg-success-soft text-success'  },
  active:    { label: '신청중',   className: 'bg-success-soft text-success'  },
  closed:    { label: '신청마감', className: 'bg-surface-muted text-gray-600' },
  draft:     { label: '준비중',   className: 'bg-warning-soft text-warning'  },
  completed: { label: '수료완료', className: 'bg-accent-pale  text-accent'   },
  expired:   { label: '기간만료', className: 'bg-danger-soft  text-danger'   },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
