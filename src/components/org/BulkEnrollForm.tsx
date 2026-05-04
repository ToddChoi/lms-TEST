'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users, BookOpen, CheckCircle2 } from 'lucide-react'

interface Member {
  id: string
  name: string | null
  email: string | null
}

interface Course {
  id: string
  title: string
  level: string | null
  price: number
  categoryName: string | null
}

interface Props {
  members: Member[]
  courses: Course[]
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: '입문', intermediate: '중급', advanced: '고급', all: '전체',
}

export function BulkEnrollForm({ members, courses }: Props) {
  const router = useRouter()
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const filteredCourses = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      (c.categoryName ?? '').toLowerCase().includes(q)
    )
  }, [courses, keyword])

  const toggleMember = (id: string) => setSelectedMembers((s) => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleCourse = (id: string) => setSelectedCourses((s) => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allMembers = () => setSelectedMembers(new Set(members.map((m) => m.id)))
  const clearMembers = () => setSelectedMembers(new Set())

  async function handleSubmit() {
    if (selectedMembers.size === 0 || selectedCourses.size === 0) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/org/bulk-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: Array.from(selectedMembers),
          courseIds: Array.from(selectedCourses),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? '신청 실패' })
      } else {
        setResult({
          ok: true,
          message: `신규 ${data.created}건 등록, 기존 ${data.skipped}건 건너뜀`,
        })
        setSelectedMembers(new Set())
        setSelectedCourses(new Set())
        // 대시보드 KPI / 수강 현황 즉시 반영
        router.refresh()
      }
    } catch {
      setResult({ ok: false, message: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 직원 선택 */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-navy">
            <Users className="h-4 w-4" /> 직원 선택
            <span className="ml-1 text-xs font-medium text-gray-400">
              {selectedMembers.size} / {members.length}
            </span>
          </h2>
          <div className="flex gap-2 text-xs">
            <button onClick={allMembers} className="text-accent hover:underline">전체</button>
            <button onClick={clearMembers} className="text-gray-500 hover:underline">해제</button>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">소속 직원이 없습니다.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto rounded-lg border border-gray-100">
            {members.map((m) => {
              const on = selectedMembers.has(m.id)
              return (
                <li key={m.id}>
                  <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition ${
                    on ? 'bg-accent-pale' : 'hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleMember(m.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{m.name ?? '이름 없음'}</p>
                      <p className="truncate text-xs text-gray-500">{m.email}</p>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 강좌 선택 */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-navy">
            <BookOpen className="h-4 w-4" /> 강좌 선택
            <span className="ml-1 text-xs font-medium text-gray-400">
              {selectedCourses.size} / {courses.length}
            </span>
          </h2>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {filteredCourses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto rounded-lg border border-gray-100">
            {filteredCourses.map((c) => {
              const on = selectedCourses.has(c.id)
              return (
                <li key={c.id}>
                  <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition ${
                    on ? 'bg-accent-pale' : 'hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleCourse(c.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{c.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        {c.categoryName && <span className="text-accent">{c.categoryName}</span>}
                        {c.level && <span>· {LEVEL_LABEL[c.level] ?? c.level}</span>}
                        <span>· {c.price === 0 ? '무료' : `${c.price.toLocaleString()}원`}</span>
                      </div>
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 제출 + 결과 */}
      <div className="lg:col-span-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm text-gray-600">
            <strong className="text-navy">{selectedMembers.size}명</strong> 직원에게{' '}
            <strong className="text-navy">{selectedCourses.size}개</strong> 강좌 신청
            (총 <strong className="text-accent">{selectedMembers.size * selectedCourses.size}건</strong>)
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedMembers.size === 0 || selectedCourses.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            일괄 신청 실행
          </button>

          {result && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {result.ok ? '✓ ' : '✗ '}{result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
