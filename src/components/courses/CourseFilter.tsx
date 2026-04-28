'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/database'

interface CourseFilterProps {
  categories: Category[]
  totalCount: number
}

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'open', label: '신청 가능' },
  { value: 'closed', label: '신청 마감' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'title', label: '강좌명순' },
  { value: 'duration', label: '학습시간순' },
]

export function CourseFilter({ categories, totalCount }: CourseFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentCategory = searchParams.get('category') || ''
  const currentStatus = searchParams.get('status') || ''
  const currentSort = searchParams.get('sort') || 'newest'
  const currentView = searchParams.get('view') || 'grid'

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page') // 필터 변경 시 첫 페이지로
    router.push(`/courses?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => updateParam('category', '')}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            !currentCategory
              ? 'bg-navy text-white'
              : 'bg-white text-gray-600 hover:bg-silver'
          )}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => updateParam('category', cat.slug)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              currentCategory === cat.slug
                ? 'bg-navy text-white'
                : 'bg-white text-gray-600 hover:bg-silver'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 상태 필터 + 정렬 + 뷰 모드 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 상태 필터 */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam('status', opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                currentStatus === opt.value
                  ? 'bg-accent text-white'
                  : 'text-gray-600 hover:bg-silver'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 정렬 */}
        <select
          value={currentSort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* 결과 수 */}
        <span className="ml-auto text-sm text-gray-500">
          총 <strong className="text-navy">{totalCount}</strong>개
        </span>

        {/* 뷰 모드 */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => updateParam('view', 'grid')}
            className={cn(
              'p-2 transition-colors',
              currentView === 'grid' ? 'bg-navy text-white' : 'text-gray-500 hover:bg-silver'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => updateParam('view', 'list')}
            className={cn(
              'p-2 transition-colors',
              currentView === 'list' ? 'bg-navy text-white' : 'text-gray-500 hover:bg-silver'
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
