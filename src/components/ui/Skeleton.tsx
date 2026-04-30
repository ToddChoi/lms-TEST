interface Props {
  className?: string
}

export function Skeleton({ className = '' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-gray-200/70 ${className}`}
    />
  )
}

/** 강좌 카드 스켈레톤 */
export function CourseCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-2 flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  )
}
