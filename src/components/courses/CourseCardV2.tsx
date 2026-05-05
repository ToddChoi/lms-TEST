'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Users, Clock, BookOpen, Heart, PlayCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

/** preview_url 이 mp4/webm 등 직접 재생 가능한 경우만 호버 자동재생 */
function isHoverPlayable(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url)
}

export interface CourseCardV2Data {
  id: string
  title: string
  thumbnail_url?: string | null
  category?: { name: string; slug?: string } | null
  instructor?: { name: string | null; avatar_url?: string | null } | null
  level?: 'beginner' | 'intermediate' | 'advanced' | 'all' | null
  rating_avg?: number | null
  rating_count?: number | null
  enrolled_count?: number | null
  total_duration?: number | null
  price?: number
  price_original?: number | null
  badge?: 'new' | 'best' | 'hot' | 'event' | 'none' | null
  preview_url?: string | null
  status?: string
}

interface Props {
  course: CourseCardV2Data
  variant?: 'default' | 'horizontal' | 'progress'
  /** variant=progress 시 진도율 (0~100) */
  progress?: number
  isWishlisted?: boolean
  onWishlistToggle?: (id: string) => void
  className?: string
}

// 듀오톤 — semantic soft 토큰 사용. Phase 3 정리.
const LEVEL_LABELS: Record<string, { label: string; cls: string }> = {
  beginner:     { label: '입문', cls: 'bg-success-soft text-success' },
  intermediate: { label: '중급', cls: 'bg-warning-soft text-warning' },
  advanced:     { label: '고급', cls: 'bg-danger-soft  text-danger'  },
  all:          { label: '전체', cls: 'bg-surface-muted text-gray-600' },
}

const BADGE_STYLES: Record<string, { label: string; cls: string }> = {
  new:   { label: 'NEW',   cls: 'bg-info-soft    text-info    ring-1 ring-info-border'    },
  best:  { label: 'BEST',  cls: 'bg-danger-soft  text-danger  ring-1 ring-danger-border'  },
  hot:   { label: 'HOT',   cls: 'bg-warning-soft text-warning ring-1 ring-warning-border' },
  event: { label: 'EVENT', cls: 'bg-accent-pale  text-accent  ring-1 ring-accent/30'      },
}

/** 카테고리명에 따라 결정되는 fallback 그라데이션 (썸네일 없을 때) */
function gradientFor(seed: string | undefined): string {
  if (!seed) return 'from-accent-pale to-accent/20'
  const palettes = [
    'from-blue-100 to-blue-300',
    'from-emerald-100 to-emerald-300',
    'from-amber-100 to-amber-300',
    'from-rose-100 to-rose-300',
    'from-purple-100 to-purple-300',
    'from-cyan-100 to-cyan-300',
    'from-indigo-100 to-indigo-300',
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palettes[h % palettes.length]
}

function priceLabel(p?: number) {
  if (p == null) return ''
  if (p === 0) return '무료'
  return `${p.toLocaleString()}원`
}

export function CourseCardV2({
  course,
  variant = 'default',
  progress,
  isWishlisted,
  onWishlistToggle,
  className = '',
}: Props) {
  const level = course.level ? LEVEL_LABELS[course.level] : null
  const badge = course.badge && course.badge !== 'none' ? BADGE_STYLES[course.badge] : null
  const hasDiscount =
    course.price != null &&
    course.price_original != null &&
    course.price_original > course.price
  const discountPct =
    hasDiscount && course.price_original
      ? Math.round((1 - (course.price ?? 0) / course.price_original) * 100)
      : 0
  const grad = gradientFor(course.category?.slug ?? course.category?.name ?? course.id)
  const hoverPreview = isHoverPlayable(course.preview_url)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleMouseEnter() {
    if (!hoverPreview) return
    videoRef.current?.play().catch(() => {})
  }
  function handleMouseLeave() {
    if (!hoverPreview) return
    const v = videoRef.current
    if (v) { v.pause(); try { v.currentTime = 0 } catch {} }
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onWishlistToggle?.(course.id)
  }

  // ─────────────────────────────────────────────────
  // horizontal: list-view (검색 결과·관련 강좌 등)
  // ─────────────────────────────────────────────────
  if (variant === 'horizontal') {
    return (
      <Link
        href={`/courses/${course.id}`}
        className={cn(
          'group flex gap-4 rounded-lg bg-surface p-3 shadow-elev-1 transition-all duration-180 ease-out-snap hover:shadow-elev-2',
          className,
        )}
      >
        <div className={cn('relative h-24 w-40 shrink-0 overflow-hidden rounded-md bg-gradient-to-br', grad)}>
          {course.thumbnail_url ? (
            <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-7 w-7 text-white/80" />
            </div>
          )}
          {badge && (
            <span className={cn('absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-micro font-bold', badge.cls)}>
              {badge.label}
            </span>
          )}
        </div>

        <div className="flex flex-1 min-w-0 flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {course.category && (
                <span className="text-caption font-medium text-accent">{course.category.name}</span>
              )}
              {level && (
                <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', level.cls)}>
                  {level.label}
                </span>
              )}
            </div>
            <h3 className="mt-0.5 font-semibold text-navy line-clamp-2 group-hover:text-accent">
              {course.title}
            </h3>
            <InstructorRow instructor={course.instructor} />
          </div>
          <CardMetaRow course={course} />
        </div>
      </Link>
    )
  }

  // ─────────────────────────────────────────────────
  // default / progress: grid card
  // ─────────────────────────────────────────────────
  return (
    <Link
      href={`/courses/${course.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg bg-surface shadow-elev-1 transition-all duration-180 ease-out-snap hover:-translate-y-0.5 hover:shadow-elev-3',
        className,
      )}
    >
      {/* 썸네일 */}
      <div className={cn('relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br', grad)}>
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover transition-transform duration-320 ease-out-soft group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-white/70" />
          </div>
        )}

        {/* 호버 시 미리보기 자동재생 (mp4/webm 등) */}
        {hoverPreview && course.preview_url && (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            ref={videoRef}
            src={course.preview_url}
            muted
            loop
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-240 ease-out-soft group-hover:opacity-100"
          />
        )}

        {/* 좌상단 배지 */}
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {badge && (
            <span className={cn('rounded-sm px-2 py-0.5 text-micro font-bold shadow-elev-1', badge.cls)}>
              {badge.label}
            </span>
          )}
          {hasDiscount && (
            <span className="rounded-sm bg-danger px-2 py-0.5 text-micro font-bold text-white shadow-elev-1">
              {discountPct}%
            </span>
          )}
        </div>

        {/* 우상단 위시리스트 / 미리보기 */}
        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-180 ease-out-snap group-hover:opacity-100">
          {course.preview_url && (
            <span
              aria-label="미리보기 가능"
              title="미리보기 영상 있음"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
            >
              <PlayCircle className="h-4 w-4" />
            </span>
          )}
          {onWishlistToggle && (
            <button
              type="button"
              onClick={handleWishlist}
              aria-label={isWishlisted ? '위시리스트에서 제거' : '위시리스트에 추가'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors duration-120',
                isWishlisted
                  ? 'bg-danger text-white'
                  : 'bg-white/85 text-gray-700 hover:bg-white'
              )}
            >
              <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
            </button>
          )}
        </div>

        {/* progress bar (variant=progress) */}
        {variant === 'progress' && progress != null && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-1.5">
          {course.category && (
            <span className="text-caption font-medium text-accent">{course.category.name}</span>
          )}
          {level && (
            <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', level.cls)}>
              {level.label}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-navy line-clamp-2 group-hover:text-accent">
          {course.title}
        </h3>

        <InstructorRow instructor={course.instructor} />

        <CardMetaRow course={course} />

        {/* 가격 또는 진도 */}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border-subtle pt-2">
          {variant === 'progress' && progress != null ? (
            <>
              <span className="text-caption text-gray-500">진도</span>
              <span className="text-body-sm font-bold text-navy">{Math.round(progress)}%</span>
            </>
          ) : course.price != null ? (
            <div className="flex flex-col items-start">
              {hasDiscount && course.price_original && (
                <span className="text-micro text-gray-400 line-through">
                  {course.price_original.toLocaleString()}원
                </span>
              )}
              <span
                className={cn(
                  'text-body-sm font-bold',
                  course.price === 0 ? 'text-success' : 'text-navy'
                )}
              >
                {priceLabel(course.price)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

/**
 * 강사 한 줄 — 아바타 + 이름.
 * 인프런/콜로소 패턴: 카드 핵심 신뢰 시그널.
 * avatar_url 없으면 이름 첫 글자 fallback.
 */
function InstructorRow({
  instructor,
}: {
  instructor?: { name: string | null; avatar_url?: string | null } | null
}) {
  if (!instructor?.name) return null
  return (
    <div className="flex items-center gap-1.5">
      {instructor.avatar_url ? (
        <Image
          src={instructor.avatar_url}
          alt={instructor.name}
          width={20}
          height={20}
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-muted text-micro font-semibold text-gray-500"
        >
          {instructor.name.slice(0, 1)}
        </span>
      )}
      <span className="text-caption text-gray-500">{instructor.name}</span>
    </div>
  )
}

/** 평점 · 수강생 · 시간 정보 한 줄 */
function CardMetaRow({ course }: { course: CourseCardV2Data }) {
  const showRating = (course.rating_count ?? 0) > 0
  const showEnrolled = (course.enrolled_count ?? 0) > 0
  const showDuration = (course.total_duration ?? 0) > 0
  if (!showRating && !showEnrolled && !showDuration) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-gray-500">
      {showRating && (
        <span className="inline-flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-warning text-warning" />
          <span className="font-semibold text-navy">{(course.rating_avg ?? 0).toFixed(1)}</span>
          <span className="text-gray-400">({(course.rating_count ?? 0).toLocaleString()})</span>
        </span>
      )}
      {showEnrolled && (
        <span className="inline-flex items-center gap-0.5">
          <Users className="h-3 w-3" /> {(course.enrolled_count ?? 0).toLocaleString()}명
        </span>
      )}
      {showDuration && course.total_duration && (
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-3 w-3" /> {formatDuration(course.total_duration)}
        </span>
      )}
    </div>
  )
}
