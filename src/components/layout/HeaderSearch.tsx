'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, BookOpen, Tag, GraduationCap, Loader2 } from 'lucide-react'

interface CourseHit {
  id: string
  title: string
  thumbnail_url: string | null
  categories?: { name: string } | null
}
interface CategoryHit {
  id: string
  name: string
  slug: string
}
interface InstructorHit {
  id: string
  name: string | null
  avatar_url: string | null
}

const RECENT_KEY = 'ingrow_recent_searches'
const MAX_RECENT = 5

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecent(q: string) {
  if (typeof window === 'undefined') return
  const cur = readRecent()
  const next = [q, ...cur.filter((x) => x !== q)].slice(0, MAX_RECENT)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
}

export function HeaderSearch({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<CourseHit[]>([])
  const [categories, setCategories] = useState<CategoryHit[]>([])
  const [instructors, setInstructors] = useState<InstructorHit[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setRecent(readRecent()) }, [])

  // 외부 클릭 시 닫기
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // debounced fetch
  useEffect(() => {
    if (!q.trim() || q.trim().length < 1) {
      setCourses([]); setCategories([]); setInstructors([])
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=5`, { signal: ctrl.signal })
        if (!res.ok) return
        const data = await res.json()
        setCourses(data.courses ?? [])
        setCategories(data.categories ?? [])
        setInstructors(data.instructors ?? [])
      } catch { /* ignore aborted */ }
      finally { setLoading(false) }
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q])

  function submit(value: string) {
    const term = value.trim()
    if (!term) return
    pushRecent(term)
    setOpen(false)
    router.push(`/courses?q=${encodeURIComponent(term)}`)
  }

  const hasResults = courses.length + categories.length + instructors.length > 0

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(q) }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          placeholder="강좌·강사·카테고리 검색"
          className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
          {!q.trim() ? (
            // 최근 검색어
            <div className="p-3">
              {recent.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-gray-400">
                  최근 검색어가 없습니다.
                </p>
              ) : (
                <>
                  <p className="mb-1 px-2 text-[11px] font-semibold text-gray-400">최근 검색어</p>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setQ(r); submit(r) }}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 transition"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> 검색 중…
            </div>
          ) : !hasResults ? (
            <p className="py-6 text-center text-sm text-gray-400">검색 결과가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {categories.length > 0 && (
                <Section icon={Tag} title="카테고리">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses?category=${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-silver"
                    >
                      <span className="text-navy">{c.name}</span>
                    </Link>
                  ))}
                </Section>
              )}

              {courses.length > 0 && (
                <Section icon={BookOpen} title="강좌">
                  {courses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-silver"
                    >
                      <span className="line-clamp-1 text-navy">{c.title}</span>
                      {c.categories?.name && (
                        <span className="ml-auto shrink-0 text-[11px] text-accent">
                          {c.categories.name}
                        </span>
                      )}
                    </Link>
                  ))}
                </Section>
              )}

              {instructors.length > 0 && (
                <Section icon={GraduationCap} title="강사">
                  {instructors.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                      <span className="text-navy">{i.name ?? '이름 없음'}</span>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  icon: Icon, title, children,
}: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="p-2">
      <p className="mb-1 flex items-center gap-1 px-2 text-[11px] font-semibold text-gray-400">
        <Icon className="h-3 w-3" /> {title}
      </p>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  )
}
