import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VideoPlayer } from '@/components/learn/VideoPlayer'
import { CurriculumSidebar } from '@/components/learn/CurriculumSidebar'
import { ChevronLeft, ChevronRight, ArrowLeft, BookOpen } from 'lucide-react'
import { formatDuration } from '@/lib/utils'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
  searchParams: { lesson?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase.from('courses').select('title').eq('id', params.id).maybeSingle()
  const course = data as unknown as { title: string } | null
  return { title: course ? `학습 — ${course.title}` : '학습' }
}

export default async function LearnPage({ params, searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 수강 확인 (비로그인이면 enrollment 없음)
  const enrollment = user ? await (async () => {
    const { data: rawEnrollment } = await supabase
      .from('enrollments').select('id, status, expires_at')
      .eq('user_id', user.id).eq('course_id', params.id).maybeSingle()
    return rawEnrollment as unknown as { id: string; status: string; expires_at: string | null } | null
  })() : null
  // 강좌 기본 정보
  const { data: rawCourse } = await supabase
    .from('courses').select('id, title, total_duration').eq('id', params.id).single()
  const course = rawCourse as unknown as { id: string; title: string; total_duration: number } | null
  if (!course) notFound()

  // 섹션 + 레슨 목록
  type LessonRaw = { id: string; title: string; video_url: string | null; duration: number; is_preview: boolean; sort_order: number }
  type SectionRaw = { id: string; title: string; sort_order: number; lessons: LessonRaw[] }

  const { data: rawSections } = await supabase
    .from('sections')
    .select('id, title, sort_order, lessons (id, title, video_url, duration, is_preview, sort_order)')
    .eq('course_id', params.id)
    .order('sort_order')
  const sections = (rawSections as unknown as SectionRaw[] | null) ?? []

  const allLessons = sections
    .flatMap((s) => s.lessons)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (allLessons.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <BookOpen className="h-12 w-12 text-gray-200" />
        <p className="font-medium text-gray-400">아직 등록된 강의가 없습니다.</p>
        <Link href={`/courses/${params.id}`} className="text-sm text-accent hover:underline">
          강좌 소개 보기
        </Link>
      </div>
    )
  }

  // 현재 강의 결정: 쿼리 파라미터 > 첫 미리보기 강의 > 첫 강의
  let currentLesson = allLessons.find((l) => l.is_preview) ?? allLessons[0]
  if (searchParams.lesson) {
    const found = allLessons.find((l) => l.id === searchParams.lesson)
    if (found) currentLesson = found
  }

  // 비로그인 사용자가 미리보기 아닌 레슨에 접근하면 로그인 페이지로
  if (!user && !currentLesson.is_preview) {
    redirect(`/login?redirectTo=/my/courses/${params.id}/learn`)
  }

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id)
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  // 내 진도 데이터 (비로그인이면 빈 배열)
  const { data: rawProgress } = user
    ? await supabase
        .from('lesson_progress').select('lesson_id, watched_seconds, is_completed')
        .eq('user_id', user.id).eq('course_id', params.id)
    : { data: null }
  const progressList = rawProgress as unknown as { lesson_id: string; watched_seconds: number; is_completed: boolean }[] | null
  const progressMap = new Map(progressList?.map((p) => [p.lesson_id, p]) ?? [])

  // 섹션에 진도 주입
  const sectionsWithProgress = sections.map((s) => ({
    ...s,
    lessons: [...s.lessons]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({
        ...l,
        is_completed: progressMap.get(l.id)?.is_completed ?? false,
        watched_seconds: progressMap.get(l.id)?.watched_seconds ?? 0,
      })),
  }))

  const currentProgress = progressMap.get(currentLesson.id)

  const isEnrolled = !!enrollment && enrollment.status === 'active'

  return (
    <div className="flex min-h-screen flex-col bg-silver">
      {/* 비로그인/비수강자 미리보기 배너 */}
      {(!user || !isEnrolled) && currentLesson.is_preview && (
        <div className="bg-accent px-4 py-2.5 text-center text-sm text-white">
          🎬 미리보기 강의입니다.&nbsp;
          <Link href={`/courses/${params.id}`} className="font-semibold underline underline-offset-2 hover:opacity-90">
            수강 신청하고 전체 강의 보기 →
          </Link>
        </div>
      )}

      {/* 상단 네비게이션 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-sm">
        <Link
          href={user ? `/my/courses` : `/courses/${params.id}`}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> {user ? '내 강의실' : '강좌 소개'}
        </Link>
        <h1 className="max-w-xs truncate text-sm font-semibold text-navy hidden sm:block">
          {course.title}
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {course.total_duration > 0 && (
            <span>{formatDuration(course.total_duration)}</span>
          )}
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:flex-row lg:items-start">
        {/* 좌측: 비디오 + 강의 정보 */}
        <main className="flex flex-col gap-4 lg:flex-1 min-w-0">
          {/* 비디오 플레이어 */}
          {isEnrolled || currentLesson.is_preview ? (
            <VideoPlayer
              lessonId={currentLesson.id}
              courseId={params.id}
              videoUrl={currentLesson.video_url}
              initialWatchedSeconds={currentProgress?.watched_seconds ?? 0}
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-navy/5">
              <BookOpen className="h-12 w-12 text-gray-200" />
              <p className="mt-3 font-medium text-gray-400">수강 신청 후 시청 가능합니다</p>
              <Link
                href={`/courses/${params.id}`}
                className="mt-3 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
              >
                수강 신청하기
              </Link>
            </div>
          )}

          {/* 강의 제목 + 이전/다음 */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-400">
                  {currentIndex + 1} / {allLessons.length}
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
                {prevLesson && (
                  <Link
                    href={`/my/courses/${params.id}/learn?lesson=${prevLesson.id}`}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    <ChevronLeft className="h-4 w-4" /> 이전
                  </Link>
                )}
                {nextLesson && (
                  <Link
                    href={`/my/courses/${params.id}/learn?lesson=${nextLesson.id}`}
                    className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-light"
                  >
                    다음 <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 우측: 커리큘럼 사이드바 */}
        <div className="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)]">
          <CurriculumSidebar
            sections={sectionsWithProgress}
            currentLessonId={currentLesson.id}
            courseId={params.id}
            isEnrolled={isEnrolled}
          />
        </div>
      </div>
    </div>
  )
}
