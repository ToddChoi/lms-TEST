import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LearnContent } from '@/components/learn/LearnContent'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { formatDuration, isEnrollmentActive } from '@/lib/utils'
import { signVideoUrl } from '@/lib/storage/video'
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

  // 수강 확인
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

  // 섹션 + 레슨 목록 — soft-deleted lesson 은 client-side 필터링.
  // P1-3 (2026-05-15): 사이드바용 SELECT 에서 video_url 제거 — 전체 강좌의 영상 URL 이
  // hydration data 로 노출되던 문제 해결. 현재 재생 중 lesson 의 video_url 은 별도 fetch.
  type LessonRaw = {
    id: string; title: string
    duration: number; is_preview: boolean; sort_order: number
    deleted_at: string | null
  }
  type SectionRaw = { id: string; title: string; sort_order: number; lessons: LessonRaw[] }

  const { data: rawSections } = await supabase
    .from('sections')
    .select('id, title, sort_order, lessons (id, title, duration, is_preview, sort_order, deleted_at)')
    .eq('course_id', params.id)
    .order('sort_order')
  const rawSectionsList = (rawSections as unknown as SectionRaw[] | null) ?? []
  // 활성 lesson 만 — deleted_at 있는 lesson 은 학습 화면 노출 X.
  const sections: SectionRaw[] = rawSectionsList.map((s) => ({
    ...s,
    lessons: (s.lessons ?? []).filter((l) => l.deleted_at === null),
  }))

  const allLessons = sections
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((s) => [...s.lessons].sort((a, b) => a.sort_order - b.sort_order))

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

  // 현재 강의 결정
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

  // 진도 데이터 (비로그인이면 빈 배열)
  const { data: rawProgress } = user
    ? await supabase
        .from('lesson_progress').select('lesson_id, watched_seconds, is_completed')
        .eq('user_id', user.id).eq('course_id', params.id)
    : { data: null }
  const progressList = rawProgress as unknown as {
    lesson_id: string; watched_seconds: number; is_completed: boolean
  }[] | null
  const progressMap = new Map(progressList?.map((p) => [p.lesson_id, p]) ?? [])

  // 섹션에 진도 주입
  const sectionsWithProgress = sections
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      ...s,
      lessons: [...s.lessons]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          ...l,
          is_completed: progressMap.get(l.id)?.is_completed ?? false,
          watched_seconds: progressMap.get(l.id)?.watched_seconds ?? 0,
        })),
    }))

  const currentProgress = progressMap.get(currentLesson.id) ?? null
  // ★ status='active' 만으론 부족 — expires_at 가 지났는데 cron 미가동으로 'active' 인
  // row 가 있을 수 있음. isEnrollmentActive 가 status + 만료 동시 검증.
  const isEnrolled = isEnrollmentActive(enrollment)

  // ★ 보안 (P1-3): course-videos 가 private 버킷이라 video_url 을 직접 노출하면 재생 안 됨.
  // 권한 검증 후 짧은 TTL 의 signed URL 로 변환해 client 에 전달.
  // 권한: 본인이 수강 중 OR 미리보기 강의 OR 관리자/강사. 그 외에는 null.
  //
  // 변경: 사이드바 SELECT 에서 video_url 제거 → 현재 lesson 의 raw video_url 만 별도 fetch.
  // 전체 강좌 영상 URL 이 hydration data 로 노출되던 문제 해결.
  const { data: rawCurrentLesson } = await supabase
    .from('lessons')
    .select('video_url')
    .eq('id', currentLesson.id)
    .maybeSingle()
  const rawVideoUrl = (rawCurrentLesson as { video_url: string | null } | null)?.video_url ?? null

  const { data: rawSelfProfile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const selfRole = (rawSelfProfile as unknown as { role: string } | null)?.role ?? null
  const canPlayLockedLesson =
    isEnrolled || (selfRole && ['admin', 'superadmin', 'instructor'].includes(selfRole))
  const signedVideoUrl =
    currentLesson.is_preview || canPlayLockedLesson
      ? await signVideoUrl(rawVideoUrl)
      : null
  const currentLessonForClient = { ...currentLesson, video_url: signedVideoUrl }

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

      {/* 상단 헤더 */}
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

      {/*
        key={currentLesson.id}: 강의가 바뀔 때마다 LearnContent를 리마운트.
        → 서버에서 최신 진도 데이터를 받아 sections state가 항상 정확하게 초기화됨.
        → 진도율이 이전 강의 state를 유지하는 버그 해결.
      */}
      <LearnContent
        key={currentLesson.id}
        courseId={params.id}
        currentLesson={currentLessonForClient}
        sections={sectionsWithProgress}
        currentProgress={currentProgress}
        isEnrolled={isEnrolled}
        currentIndex={currentIndex}
        totalLessons={allLessons.length}
        prevLessonId={prevLesson?.id ?? null}
        nextLessonId={nextLesson?.id ?? null}
      />
    </div>
  )
}
