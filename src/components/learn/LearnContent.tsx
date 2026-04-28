'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, BookOpen, ListTree, NotebookPen } from 'lucide-react'
import { VideoPlayer } from '@/components/learn/VideoPlayer'
import { CurriculumSidebar } from '@/components/learn/CurriculumSidebar'
import { NotesPanel } from '@/components/learn/NotesPanel'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog'
import { formatDuration } from '@/lib/utils'

interface LessonItem {
  id: string
  title: string
  video_url: string | null
  duration: number
  is_preview: boolean
  sort_order: number
}

interface SectionWithProgress {
  id: string
  title: string
  sort_order: number
  lessons: Array<LessonItem & {
    is_completed: boolean
    watched_seconds: number
  }>
}

interface Props {
  courseId: string
  currentLesson: LessonItem
  sections: SectionWithProgress[]
  currentProgress: { watched_seconds: number; is_completed: boolean } | null
  isEnrolled: boolean
  currentIndex: number
  totalLessons: number
  prevLessonId: string | null
  nextLessonId: string | null
}

type SideTab = 'curriculum' | 'notes'

export function LearnContent({
  courseId,
  currentLesson,
  sections: initialSections,
  currentProgress,
  isEnrolled,
  currentIndex,
  totalLessons,
  prevLessonId,
  nextLessonId,
}: Props) {
  const [sections, setSections] = useState<SectionWithProgress[]>(initialSections)
  const [tab, setTab] = useState<SideTab>('curriculum')

  const handleComplete = useCallback(() => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) =>
          l.id === currentLesson.id ? { ...l, is_completed: true } : l
        ),
      }))
    )
  }, [currentLesson.id])

  const handleProgressSave = useCallback((seconds: number) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) =>
          l.id === currentLesson.id ? { ...l, watched_seconds: seconds } : l
        ),
      }))
    )
  }, [currentLesson.id])

  const learnUrl = (lessonId: string) => `/my/courses/${courseId}/learn?lesson=${lessonId}`

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-start">
      {/* 좌측: 비디오 + 강의 정보 */}
      <main className="flex flex-col gap-4 lg:flex-1 min-w-0">
        {/* 비디오 플레이어 */}
        {isEnrolled || currentLesson.is_preview ? (
          <VideoPlayer
            lessonId={currentLesson.id}
            courseId={courseId}
            videoUrl={currentLesson.video_url}
            initialWatchedSeconds={currentProgress?.watched_seconds ?? 0}
            isInitiallyCompleted={currentProgress?.is_completed ?? false}
            onComplete={handleComplete}
            onProgressSave={handleProgressSave}
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-navy/5">
            <BookOpen className="h-12 w-12 text-gray-200" />
            <p className="mt-3 font-medium text-gray-400">수강 신청 후 시청 가능합니다</p>
            <Link
              href={`/courses/${courseId}`}
              className="mt-3 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
            >
              수강 신청하기
            </Link>
          </div>
        )}

        {/* 강의 제목 + 이전/다음 버튼 */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">
                {currentIndex + 1} / {totalLessons}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-navy">
                {currentLesson.title}
              </h2>
              {currentLesson.duration > 0 && (
                <p className="mt-1 text-sm text-gray-400">
                  {formatDuration(currentLesson.duration)}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {prevLessonId && (
                <Link
                  href={learnUrl(prevLessonId)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                >
                  <ChevronLeft className="h-4 w-4" /> 이전
                </Link>
              )}
              {nextLessonId && (
                <Link
                  href={learnUrl(nextLessonId)}
                  className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-light"
                >
                  다음 <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 우측: 사이드 탭 (커리큘럼 / 노트) */}
      <div className="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] flex flex-col">
        {/* 탭 헤더 */}
        <div className="mb-2 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          <TabButton active={tab === 'curriculum'} onClick={() => setTab('curriculum')}>
            <ListTree className="h-4 w-4" /> 커리큘럼
          </TabButton>
          <TabButton active={tab === 'notes'} onClick={() => setTab('notes')}>
            <NotebookPen className="h-4 w-4" /> 노트
          </TabButton>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'curriculum' ? (
            <CurriculumSidebar
              sections={sections}
              currentLessonId={currentLesson.id}
              courseId={courseId}
              isEnrolled={isEnrolled}
            />
          ) : (
            <NotesPanel lessonId={currentLesson.id} courseId={courseId} />
          )}
        </div>
      </div>

      {/* 노트 삭제 등 confirm 다이얼로그 호스트 */}
      <ConfirmDialogHost />
    </div>
  )
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-accent text-white'
          : 'text-gray-500 hover:text-navy'
      }`}
    >
      {children}
    </button>
  )
}
