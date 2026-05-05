'use client'

/**
 * 강좌 multi-pick 모달.
 * PageBuilder 의 course_picker field 에서 사용.
 *
 * UX:
 *   - 입력란에 검색
 *   - 결과 카드 grid — 클릭으로 선택/해제
 *   - 선택된 강좌 chip 표시
 *   - "확인" → 부모에 ID 배열 콜백
 */
import { useState, useEffect } from 'react'
import { X, Search, CheckCircle } from 'lucide-react'

interface Course {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  status: string
}

interface Props {
  initialIds: string[]
  onClose: () => void
  onConfirm: (ids: string[]) => void
}

export function CoursePicker({ initialIds, onClose, onConfirm }: Props) {
  const [q, setQ] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [selectedMap, setSelectedMap] = useState<Map<string, Course>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/courses/search?q=${encodeURIComponent(q)}&limit=30`, {
          signal: ctrl.signal,
        })
        const { courses } = await res.json()
        setCourses(courses ?? [])
        // 검색 결과로 selectedMap 보강 (이미 선택된 강좌 정보 캐시)
        setSelectedMap((prev) => {
          const next = new Map(prev)
          ;(courses ?? []).forEach((c: Course) => {
            if (selectedIds.includes(c.id)) next.set(c.id, c)
          })
          return next
        })
      } catch {
        // abort 무시
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, selectedIds])

  const toggle = (c: Course) => {
    setSelectedIds((ids) =>
      ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]
    )
    setSelectedMap((prev) => new Map(prev).set(c.id, c))
  }

  const remove = (id: string) => {
    setSelectedIds((ids) => ids.filter((x) => x !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-lg bg-surface p-5 shadow-elev-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-h5 text-navy">강좌 선택</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 선택된 chip */}
        {selectedIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 rounded-md bg-surface-subtle p-2">
            {selectedIds.map((id) => {
              const c = selectedMap.get(id)
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-md bg-accent-pale px-2 py-1 text-caption text-accent"
                >
                  {c?.title ?? id.slice(0, 8)}
                  <button onClick={() => remove(id)} className="ml-1 hover:text-danger">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* 검색 */}
        <div className="mt-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="강좌 제목 검색"
            className="w-full rounded-md border border-border-subtle bg-surface py-2 pl-9 pr-3 text-body-sm focus:border-accent focus:outline-none"
            autoFocus
          />
        </div>

        {/* 결과 */}
        <div className="mt-3 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-body-sm text-gray-500">검색 중...</p>
          ) : courses.length === 0 ? (
            <p className="py-4 text-center text-body-sm text-gray-500">검색 결과가 없습니다.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {courses.map((c) => {
                const sel = selectedIds.includes(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition ${
                        sel
                          ? 'border-accent bg-accent-pale'
                          : 'border-border-subtle bg-surface hover:bg-surface-muted'
                      }`}
                    >
                      {c.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.thumbnail_url} alt="" className="h-12 w-16 rounded-sm object-cover" />
                      ) : (
                        <div className="h-12 w-16 rounded-sm bg-surface-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-navy">{c.title}</p>
                        <p className="text-caption text-gray-500">{c.status}</p>
                      </div>
                      {sel && <CheckCircle className="h-4 w-4 shrink-0 text-accent" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">
            취소
          </button>
          <button
            onClick={() => onConfirm(selectedIds)}
            className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light"
          >
            {selectedIds.length}개 선택 완료
          </button>
        </div>
      </div>
    </div>
  )
}
