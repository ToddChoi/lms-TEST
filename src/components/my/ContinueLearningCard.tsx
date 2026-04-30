import Link from 'next/link'
import Image from 'next/image'
import { PlayCircle, BookOpen, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

interface Props {
  course: {
    id: string
    title: string
    thumbnail_url: string | null
    total_duration: number
    category?: string | null
  }
  lesson?: { id: string; title: string } | null
  progressPercent: number
}

/** 가장 최근 학습 강좌 — 큰 "이어보기" CTA */
export function ContinueLearningCard({ course, lesson, progressPercent }: Props) {
  return (
    <Link
      href={`/my/courses/${course.id}/learn${lesson?.id ? `?lesson=${lesson.id}` : ''}`}
      className="group relative flex overflow-hidden rounded-2xl bg-gradient-to-r from-navy to-navy-light text-white shadow-md transition hover:shadow-xl"
    >
      <div className="relative h-32 w-44 shrink-0 overflow-hidden sm:h-40 sm:w-56">
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url} alt={course.title} fill
            sizes="224px"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white/10">
            <BookOpen className="h-10 w-10 text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-navy/60" />
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/60">이어서 학습하기</p>
          <h3 className="mt-1 line-clamp-1 text-base font-bold sm:text-lg">{course.title}</h3>
          {lesson?.title && (
            <p className="mt-0.5 line-clamp-1 text-xs text-white/70">▶ {lesson.title}</p>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-accent-light transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
            <span className="text-xs font-semibold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            {course.total_duration > 0 && (
              <span className="inline-flex items-center gap-1 text-white/70">
                <Clock className="h-3 w-3" /> {formatDuration(course.total_duration)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold transition group-hover:bg-accent-light">
              <PlayCircle className="h-3.5 w-3.5" /> 이어보기
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
