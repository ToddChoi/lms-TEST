import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EnrollButton } from '@/components/courses/EnrollButton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CourseReviewSection } from '@/components/courses/CourseReviewSection'
import { CourseQASection } from '@/components/courses/CourseQASection'
import { SimilarCoursesSection } from '@/components/courses/SimilarCoursesSection'
import { CoursePreviewModal } from '@/components/courses/CoursePreviewModal'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog'
import {
  BookOpen, Clock, Users, Calendar, ChevronDown, User, PlayCircle,
} from 'lucide-react'
import { formatDuration, formatDate, isEnrollable } from '@/lib/utils'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('courses')
    .select('title, description, thumbnail_url')
    .eq('id', params.id)
    .maybeSingle()

  const course = data as
    | { title: string; description: string | null; thumbnail_url: string | null }
    | null

  if (!course) {
    return { title: '강좌 상세' }
  }

  const desc = course.description?.slice(0, 160) ?? undefined

  return {
    title: course.title,
    description: desc,
    openGraph: {
      title: course.title,
      description: desc,
      images: course.thumbnail_url ? [course.thumbnail_url] : [],
    },
  }
}

export default async function CourseDetailPage({ params }: Props) {
  const supabase = createClient()

  // 강좌 정보
  type CourseDetail = {
    id: string; title: string; description: string | null
    thumbnail_url: string | null; price: number
    total_duration: number; status: string; level: string
    enroll_start: string | null; enroll_end: string | null
    learn_start: string | null; learn_end: string | null
    preview_url: string | null
    categories: { id: string; name: string; slug: string } | null
    instructor: { id: string; name: string; avatar_url: string | null } | null
  }

  const { data: rawCourse } = await supabase
    .from('courses')
    .select(`*, categories (id, name, slug), instructor:profiles!instructor_id (id, name, avatar_url)`)
    .eq('id', params.id)
    .eq('status', 'active')
    .single()

  const course = rawCourse as unknown as CourseDetail | null
  if (!course) notFound()

  // 섹션 + 레슨 목록
  type LessonRow = { id: string; title: string; duration: number; is_preview: boolean; sort_order: number }
  type SectionWithLessons = { id: string; title: string; sort_order: number; lessons: LessonRow[] }

  const { data: rawSections } = await supabase
    .from('sections')
    .select(`id, title, sort_order, lessons (id, title, duration, is_preview, sort_order)`)
    .eq('course_id', params.id)
    .order('sort_order')

  const sections = rawSections as unknown as SectionWithLessons[] | null

  const sortedSections: SectionWithLessons[] = (sections ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    sort_order: s.sort_order,
    lessons: [...s.lessons].sort((a, b) => a.sort_order - b.sort_order),
  }))

  // 수강생 수
  const { count: enrollmentCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', params.id)

  // 현재 로그인 사용자 & 수강 여부
  const { data: { user } } = await supabase.auth.getUser()
  let enrolled = false
  if (user) {
    const { data } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', params.id)
      .eq('status', 'active')
      .maybeSingle()
    enrolled = !!data
  }

  const enrollable = isEnrollable(course.enroll_start, course.enroll_end)
  const category = course.categories as { name: string; slug: string } | null
  const instructor = course.instructor as { id: string; name: string; avatar_url: string | null } | null

  const totalLessons = sortedSections.reduce((acc, s) => acc + s.lessons.length, 0)
  const badgeStatus = enrollable ? 'open' : 'closed'

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: course.title,
            description: course.description,
            provider: {
              '@type': 'Organization',
              name: 'Ingrow LMS',
              sameAs:
                process.env.NEXT_PUBLIC_APP_URL ??
                'http://localhost:3000',
            },
            ...(course.thumbnail_url ? { image: course.thumbnail_url } : {}),
          }),
        }}
      />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">

        {/* ── 좌측: 강좌 정보 ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* 카테고리 + 배지 */}
          <div className="flex items-center gap-2">
            {category && (
              <span className="text-sm font-medium text-accent">{category.name}</span>
            )}
            <StatusBadge status={badgeStatus} />
          </div>

          <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">
            {course.title}
          </h1>

          {course.description && (
            <p className="mt-3 text-gray-600 leading-relaxed">{course.description}</p>
          )}

          {/* 메타 정보 */}
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
            {enrollmentCount !== null && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> 수강생 {enrollmentCount.toLocaleString()}명
              </span>
            )}
            {course.total_duration > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {formatDuration(course.total_duration)}
              </span>
            )}
            {totalLessons > 0 && (
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {totalLessons}개 강의
              </span>
            )}
          </div>

          {/* 강사 소개 */}
          {instructor && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-silver p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-pale">
                {instructor.avatar_url ? (
                  <Image src={instructor.avatar_url} alt={instructor.name} width={48} height={48} className="rounded-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-accent" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400">강사</p>
                <p className="font-semibold text-navy">{instructor.name}</p>
              </div>
            </div>
          )}

          {/* 커리큘럼 */}
          {sortedSections.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-navy">커리큘럼</h2>
              <p className="mt-1 text-sm text-gray-500">
                총 {sortedSections.length}섹션 · {totalLessons}강의 · {formatDuration(course.total_duration)}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {sortedSections.map((section) => (
                  <details key={section.id} className="group rounded-xl border border-gray-100 bg-white" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                      <span className="font-semibold text-navy">{section.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{section.lessons.length}강의</span>
                        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="border-t border-gray-100">
                      {section.lessons.map((lesson, idx) => {
                        const inner = (
                          <>
                            <span className="w-5 shrink-0 text-center text-xs text-gray-300">{idx + 1}</span>
                            {lesson.is_preview
                              ? <PlayCircle className="h-4 w-4 shrink-0 text-accent" />
                              : <BookOpen className="h-4 w-4 shrink-0 text-gray-300" />
                            }
                            <span className="flex-1 text-gray-700">{lesson.title}</span>
                            {lesson.is_preview && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
                                미리보기
                              </span>
                            )}
                            {lesson.duration > 0 && (
                              <span className="shrink-0 text-xs text-gray-400">{formatDuration(lesson.duration)}</span>
                            )}
                          </>
                        )
                        return lesson.is_preview ? (
                          <Link
                            key={lesson.id}
                            href={`/my/courses/${course.id}/learn?lesson=${lesson.id}`}
                            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent-pale transition-colors"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-silver">
                            {inner}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* ── 수강평 + Q&A ── */}
          <CourseReviewSection
            courseId={course.id}
            currentUserId={user?.id ?? null}
            isEnrolled={enrolled}
          />
          <CourseQASection
            courseId={course.id}
            currentUserId={user?.id ?? null}
            isEnrolled={enrolled}
          />
          <SimilarCoursesSection
            courseId={course.id}
            categoryId={course.categories?.id ?? null}
            level={course.level ?? null}
            limit={4}
          />
          <ConfirmDialogHost />
        </div>

        {/* ── 우측: 수강 신청 카드 (sticky) ── */}
        <div className="w-full lg:w-80 lg:shrink-0">
          <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-md">
            {/* 썸네일 */}
            <div className="relative mb-4 h-44 overflow-hidden rounded-xl bg-gradient-to-br from-accent-pale to-accent/10">
              {course.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-14 w-14 text-accent/30" />
                </div>
              )}
            </div>

            {/* 가격 */}
            <div className="mb-4">
              <span className={`text-2xl font-bold ${course.price === 0 ? 'text-green-600' : 'text-navy'}`}>
                {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
              </span>
            </div>

            {/* 수강 기간 정보 */}
            <div className="mb-4 flex flex-col gap-2 rounded-xl bg-silver p-3 text-sm">
              {course.enroll_start || course.enroll_end ? (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    신청 기간:{' '}
                    {course.enroll_start ? formatDate(course.enroll_start) : '상시'} ~{' '}
                    {course.enroll_end ? formatDate(course.enroll_end) : '상시'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>상시 수강 신청 가능</span>
                </div>
              )}
              {course.learn_start && (
                <div className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>
                    학습 기간: {formatDate(course.learn_start)} ~{' '}
                    {course.learn_end ? formatDate(course.learn_end) : '제한 없음'}
                  </span>
                </div>
              )}
              {course.total_duration > 0 && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>총 학습 시간 {formatDuration(course.total_duration)}</span>
                </div>
              )}
            </div>

            {course.preview_url && (
              <div className="mb-3">
                <CoursePreviewModal
                  previewUrl={course.preview_url}
                  courseTitle={course.title}
                  variant="outline"
                  className="w-full"
                />
              </div>
            )}

            <EnrollButton
              courseId={course.id}
              isLoggedIn={!!user}
              isEnrolled={enrolled}
              isEnrollable={enrollable}
              price={course.price}
            />
          </div>
        </div>
      </div>

      {/* 모바일 전용 하단 sticky CTA (lg 미만) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-gray-400">수강료</span>
            <span className={`text-base font-bold ${course.price === 0 ? 'text-emerald-600' : 'text-navy'}`}>
              {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
            </span>
          </div>
          <div className="ml-auto flex-1 max-w-[60%]">
            <EnrollButton
              courseId={course.id}
              isLoggedIn={!!user}
              isEnrolled={enrolled}
              isEnrollable={enrollable}
              price={course.price}
            />
          </div>
        </div>
      </div>
      {/* sticky 바와 본문이 겹치지 않게 페이지 하단 여백 */}
      <div className="h-20 lg:hidden" />
    </div>
  )
}
