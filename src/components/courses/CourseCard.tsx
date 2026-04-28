import Link from 'next/link'
import Image from 'next/image'
import { Clock, BookOpen } from 'lucide-react'
import { cn, formatDuration, isEnrollable } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { CourseWithCategory } from '@/types/database'

interface CourseCardProps {
  course: CourseWithCategory & { instructor?: { name: string } | null }
  view?: 'grid' | 'list'
}

export function CourseCard({ course, view = 'grid' }: CourseCardProps) {
  const enrollable = isEnrollable(course.enroll_start, course.enroll_end)
  const badgeStatus = course.status === 'active'
    ? (enrollable ? 'open' : 'closed')
    : (course.status as 'draft')

  if (view === 'list') {
    return (
      <Link
        href={`/courses/${course.id}`}
        className="group flex gap-4 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        {/* 썸네일 */}
        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-accent-pale">
          {course.thumbnail_url ? (
            <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-8 w-8 text-accent/40" />
            </div>
          )}
        </div>

        {/* 내용 */}
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {course.categories && (
              <span className="text-xs font-medium text-accent">
                {course.categories.name}
              </span>
            )}
            <h3 className="mt-0.5 font-semibold text-navy line-clamp-2 group-hover:text-accent">
              {course.title}
            </h3>
            {course.instructor && (
              <p className="mt-0.5 text-xs text-gray-500">{course.instructor.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={badgeStatus} />
            {course.total_duration > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {formatDuration(course.total_duration)}
              </span>
            )}
            <span className="ml-auto text-sm font-bold text-navy">
              {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* 썸네일 */}
      <div className="relative h-44 overflow-hidden rounded-t-2xl bg-gradient-to-br from-accent-pale to-accent/10">
        {course.thumbnail_url ? (
          <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-accent/30" />
          </div>
        )}
      </div>

      {/* 내용 */}
      <div className="flex flex-1 flex-col p-4">
        {course.categories && (
          <span className="text-xs font-medium text-accent">
            {course.categories.name}
          </span>
        )}
        <h3 className="mt-1 font-semibold text-navy line-clamp-2 group-hover:text-accent">
          {course.title}
        </h3>
        {course.instructor && (
          <p className="mt-1 text-xs text-gray-500">{course.instructor.name}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <StatusBadge status={badgeStatus} />
          <div className="flex items-center gap-2">
            {course.total_duration > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {formatDuration(course.total_duration)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 border-t border-gray-50 pt-2">
          <span className={cn(
            'text-sm font-bold',
            course.price === 0 ? 'text-green-600' : 'text-navy'
          )}>
            {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
          </span>
        </div>
      </div>
    </Link>
  )
}
