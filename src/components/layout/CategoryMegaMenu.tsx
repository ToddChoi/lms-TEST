'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

interface CategoryHit {
  id: string
  name: string
  slug: string
  icon?: string | null
}

/**
 * 헤더 카테고리 메가메뉴.
 * - "강좌" 텍스트에 hover 시 풀폭 드롭다운
 * - 카테고리는 처음 hover 될 때 한 번만 fetch 후 캐시
 */
export function CategoryMegaMenu() {
  const [open, setOpen] = useState(false)
  const [cats, setCats] = useState<CategoryHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const closeTimer = useRef<NodeJS.Timeout | null>(null)

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
    if (cats == null && !loading) {
      setLoading(true)
      fetch('/api/categories')
        .then((r) => r.json())
        .then((d) => setCats(d.data ?? []))
        .catch(() => setCats([]))
        .finally(() => setLoading(false))
    }
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
      onFocusCapture={show}
      onBlurCapture={scheduleClose}
    >
      <Link
        href="/courses"
        className="inline-flex items-center gap-0.5 text-sm font-medium text-gray-600 transition-colors hover:text-navy"
      >
        강좌
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Link>

      {open && (
        <div
          className="absolute left-1/2 top-full z-40 mt-1 w-[680px] -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-5 shadow-xl"
          role="menu"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">카테고리</h3>
            <Link href="/courses" className="text-xs text-accent hover:underline">
              전체 강좌 →
            </Link>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">카테고리 불러오는 중…</p>
          ) : cats && cats.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {cats.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses?category=${c.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-accent-pale hover:text-accent"
                >
                  {c.icon && <span className="text-base">{c.icon}</span>}
                  <span>{c.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">등록된 카테고리가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
