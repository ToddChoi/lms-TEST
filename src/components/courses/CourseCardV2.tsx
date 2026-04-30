import Link from 'next/link'
import Image from 'next/image'
import { Star, Users, Clock, BookOpen, Heart, PlayCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

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

const LEVEL_LABELS: Record<string, { label: string; cls: string }> = {
  beginner:     { label: '입문', cls: 'bg-emerald-50 text-emerald-700' },
  intermediate: { label: '중급', cls: 'bg-amber-50  text-amber-700'   },
  advanced:     { label: '고급', cls: 'bg-rose-50   text-rose-700'    },
  all:          { label: '전체', cls: 'bg-slate-100 text-slate-700'   },
}

const BADGE_STYLES: Record<string, { label: string; cls: string }> = {
  new:   { label: 'NEW',   cls: 'bg-blue-500   text-white' },
  best:  { label: 'BEST',  cls: 'bg-rose-500   text-white' },
  hot:   { label: 'HOT',   cls: 'bg-orange-500 text-white' },
  event: { label: 'EVENT', cls: 'bg-purple-500 text-white' },
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
          'group flex gap-4 rounded-2xl bg-white p-3 shadow-sm transition-all hover:shadow-md',
          className,
        )}
      >
        <div className={cn('relative h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br', grad)}>
          {course.thumbnail_url ? (
            <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-7 w-7 text-white/80" />
            </div>
          )}
          {badge && (
            <span className={cn('absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold', badge.cls)}>
              {badge.label}
            </span>
          )}
        </div>

        <div className="flex flex-1 min-w-0 flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {course.category && (
                <span className="text-xs font-medium text-accent">{course.category.name}</span>
              )}
              {level && (
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', level.cls)}>
                  {level.label}
                </span>
              )}
            </div>
            <h3 className="mt-0.5 font-semibold text-navy line-clamp-2 group-hover:text-accent">
              {course.title}
            </h3>
            {course.instructor?.name && (
              <p className="mt-0.5 text-xs text-gray-500">{course.instructor.name}</p>
            )}
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
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
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
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-white/70" />
          </div>
        )}

        {/* 좌상단 배지 */}
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {badge && (
            <span className={cn('rounded px-2 py-0.5 text-[11px] font-bold shadow', badge.cls)}>
              {badge.label}
            </span>
          )}
          {hasDiscount && (
            <span className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
              {discountPct}%
            </span>
          )}
        </div>

        {/* 우상단 위시리스트 / 미리보기 */}
        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
                'flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition',
                isWishlisted
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/80 text-gray-700 hover:bg-white'
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
            <span className="text-xs font-medium text-accent">{course.category.name}</span>
          )}
          {level && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', level.cls)}>
              {level.label}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-navy line-clamp-2 group-hover:text-accent">
          {course.title}
        </h3>

        {course.instructor?.name && (
          <p className="text-xs text-gray-500">{course.instructor.name}</p>
        )}

        <CardMetaRow course={course} />

        {/* 가격 또는 진도 */}
        <div className="mt-auto pt-2 border-t border-gray-50 flex items-end justify-between gap-2">
          {variant === 'progress' && progress != null ? (
            <>
              <span className="text-xs text-gray-500">진도</span>
              <span className="text-sm font-bold text-navy">{Math.round(progress)}%</span>
            </>
          ) : course.price != null ? (
            <div className="flex flex-col items-start">
              {hasDiscount && course.price_original && (
                <span className="text-[11px] text-gray-400 line-through">
                  {course.price_original.toLocaleString()}원
                </span>
              )}
              <span
                className={cn(
                  'text-sm font-bold',
                  course.price === 0 ? 'text-emerald-600' : 'text-navy'
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

/** 평점 · 수강생 · 시간 정보 한 줄 */
function CardMetaRow({ course }: { course: CourseCardV2Data }) {
  const showRating = (course.rating_count ?? 0) > 0
  const showEnrolled = (course.enrolled_count ?? 0) > 0
  const showDuration = (course.total_duration ?? 0) > 0
  if (!showRating && !showEnrolled && !showDuration) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500">
      {showRating && (
        <span className="inline-flex items-center gap-0.5">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
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
