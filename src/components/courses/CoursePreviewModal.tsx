'use client'

import { useEffect, useState } from 'react'
import { X, PlayCircle } from 'lucide-react'
import { detectVideoSource } from '@/lib/video-source'

interface Props {
  /** 강좌 미리보기 영상 URL (YouTube/Vimeo/mp4 모두 가능) */
  previewUrl: string | null
  courseTitle: string
  /** 트리거 버튼 스타일 — 기본 / outline */
  variant?: 'default' | 'outline'
  className?: string
}

/**
 * 강좌 상세 페이지에서 "미리보기 ▶" 버튼 클릭 시 모달로 영상 재생.
 * 진도 저장·로그인 없이 단순 시청용.
 */
export function CoursePreviewModal({
  previewUrl, courseTitle, variant = 'default', className = '',
}: Props) {
  const [open, setOpen] = useState(false)

  // ESC 키로 닫기 + 스크롤 잠금
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!previewUrl) return null

  const source = detectVideoSource(previewUrl)
  const buttonClass =
    variant === 'outline'
      ? 'border border-accent text-accent hover:bg-accent hover:text-white'
      : 'bg-navy text-white hover:bg-navy-light'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${buttonClass} ${className}`}
      >
        <PlayCircle className="h-4 w-4" /> 미리보기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${courseTitle} 미리보기`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-sm text-white">
              <PlayCircle className="h-4 w-4 text-accent-light" />
              <span className="font-medium">{courseTitle} 미리보기</span>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              {source.type === 'youtube' && source.id ? (
                <iframe
                  src={`https://www.youtube.com/embed/${source.id}?autoplay=1&rel=0`}
                  className="absolute inset-0 h-full w-full"
                  title={courseTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : source.type === 'vimeo' && source.id ? (
                <iframe
                  src={`https://player.vimeo.com/video/${source.id}?autoplay=1`}
                  className="absolute inset-0 h-full w-full"
                  title={courseTitle}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <video
                  src={source.url}
                  controls
                  autoPlay
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </div>

            <p className="mt-2 text-xs text-white/60">
              ESC 키 또는 바깥 영역을 클릭해 닫을 수 있어요.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
