'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { CourseFilterSidebar } from './CourseFilterSidebar'

interface Props {
  /** 현재 필터 적용된 결과 강좌 수 — "결과 N개 보기" 버튼 라벨에 사용 */
  totalCount: number
}

/**
 * 모바일 (< lg) 에서 상세 필터에 접근하기 위한 trigger + 바텀시트.
 * 데스크탑은 좌측 사이드바 (CourseFilterSidebar) 가 직접 노출되므로 이 컴포넌트는
 * `lg:hidden` 으로 숨김.
 *
 * 안에서 필터 변경 시 즉시 URL 갱신 (CourseFilterSidebar 의 router.push 그대로) —
 * totalCount 는 page re-render 로 자동 업데이트됨. "결과 N개 보기" 누르면 시트 닫힘.
 */
export function CourseFilterMobile({ totalCount }: Props) {
  const [open, setOpen] = useState(false)
  const sp = useSearchParams()

  // 활성 필터 개수 — trigger 버튼 배지
  const activeCount = countActive(sp)

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-accent hover:text-accent transition"
        aria-label="상세 필터 열기"
      >
        <SlidersHorizontal className="h-4 w-4" />
        필터
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[100] flex items-end bg-black/50"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="상세 필터"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full flex-col rounded-t-3xl bg-white shadow-2xl max-h-[85vh]"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-bold text-navy">상세 필터</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-gray-400 hover:bg-silver hover:text-navy transition"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 사이드바 재사용 — shadow/패딩은 컨테이너가 이미 가지므로 사이드바 자체는 평면 */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              <CourseFilterSidebar className="!shadow-none !p-0 !rounded-none" />
            </div>

            {/* 푸터 — 결과 보기 */}
            <div className="border-t border-gray-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
              >
                결과 {totalCount}개 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** 활성 필터 개수 — level (다중) + price + rating_gte + duration */
function countActive(sp: URLSearchParams): number {
  let n = 0
  n += (sp.get('level') ?? '').split(',').filter(Boolean).length
  if (sp.get('price')) n += 1
  if (sp.get('rating_gte')) n += 1
  if (sp.get('duration')) n += 1
  return n
}
