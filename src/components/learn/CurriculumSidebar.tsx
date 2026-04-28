'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, Lock, ChevronDown, PlayCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  duration: number
  is_preview: boolean
  sort_order: number
  is_completed?: boolean
  watched_seconds?: number
}

interface Section {
  id: string
  title: string
  sort_order: number
  lessons: Lesson[]
}

interface CurriculumSidebarProps {
  sections: Section[]
  currentLessonId: string
  courseId: string
  isEnrolled: boolean
}

export function CurriculumSidebar({
  sections, currentLessonId, courseId, isEnrolled,
}: CurriculumSidebarProps) {
  const router = useRouter()
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id))
  )

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0)
  const completedLessons = sections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.is_completed).length, 0
  )
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleLessonClick = (lesson: Lesson) => {
    if (!isEnrolled && !lesson.is_preview) return
    router.push(`/my/courses/${courseId}/learn?lesson=${lesson.id}`)
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* 헤더 & 진도 */}
      <div className="border-b border-gray-100 p-4">
        <h2 className="font-bold text-navy">커리큘럼</h2>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-gray-500">
            {completedLessons}/{totalLessons} ({progress}%)
          </span>
        </div>
      </div>

      {/* 섹션 목록 */}
      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-gray-50 last:border-0">
            <button
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-silver"
            >
              <span className="text-sm font-semibold text-navy text-left">{section.title}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                  openSections.has(section.id) && 'rotate-180'
                )}
              />
            </button>

            {openSections.has(section.id) && (
              <div>
                {section.lessons.map((lesson) => {
                  const isCurrent = lesson.id === currentLessonId
                  const locked = !isEnrolled && !lesson.is_preview

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => handleLessonClick(lesson)}
                      disabled={locked}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                        isCurrent ? 'bg-accent-pale' : 'hover:bg-silver',
                        locked && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      {/* 완료 아이콘 */}
                      {lesson.is_completed ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                      ) : locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-gray-300" />
                      ) : isCurrent ? (
                        <PlayCircle className="h-4 w-4 shrink-0 text-accent" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                      )}

                      <span className={cn(
                        'flex-1 leading-snug line-clamp-2',
                        isCurrent ? 'font-semibold text-accent' : 'text-gray-700'
                      )}>
                        {lesson.title}
                      </span>

                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {lesson.is_preview && !isEnrolled && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-600">
                            미리보기
                          </span>
                        )}
                        {lesson.duration > 0 && (
                          <span className="text-xs text-gray-400">
                            {formatDuration(lesson.duration)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
