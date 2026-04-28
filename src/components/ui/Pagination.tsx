'use client'

import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  totalCount: number
  pageSize?: number
  basePath?: string
}

export function Pagination({ totalCount, pageSize = 12, basePath }: PaginationProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const currentPage = Number(searchParams.get('page') || 1)
  const totalPages = Math.ceil(totalCount / pageSize)

  if (totalPages <= 1) return null

  const base = basePath ?? pathname

  const makeHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `${base}?${params.toString()}`
  }

  // 표시할 페이지 번호 범위 계산
  const delta = 2
  const range: number[] = []
  for (
    let i = Math.max(1, currentPage - delta);
    i <= Math.min(totalPages, currentPage + delta);
    i++
  ) {
    range.push(i)
  }

  return (
    <nav className="flex items-center justify-center gap-1">
      <Link
        href={makeHref(currentPage - 1)}
        aria-disabled={currentPage === 1}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors',
          currentPage === 1
            ? 'pointer-events-none opacity-40'
            : 'hover:border-accent hover:text-accent'
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {range[0] > 1 && (
        <>
          <Link href={makeHref(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-sm hover:border-accent hover:text-accent">
            1
          </Link>
          {range[0] > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}

      {range.map((page) => (
        <Link
          key={page}
          href={makeHref(page)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
            page === currentPage
              ? 'border-accent bg-accent text-white'
              : 'border-gray-200 text-gray-700 hover:border-accent hover:text-accent'
          )}
        >
          {page}
        </Link>
      ))}

      {range[range.length - 1] < totalPages && (
        <>
          {range[range.length - 1] < totalPages - 1 && (
            <span className="px-1 text-gray-400">…</span>
          )}
          <Link href={makeHref(totalPages)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-sm hover:border-accent hover:text-accent">
            {totalPages}
          </Link>
        </>
      )}

      <Link
        href={makeHref(currentPage + 1)}
        aria-disabled={currentPage === totalPages}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors',
          currentPage === totalPages
            ? 'pointer-events-none opacity-40'
            : 'hover:border-accent hover:text-accent'
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  )
}
