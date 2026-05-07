import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  active: '수강중',
  completed: '수료',
  expired: '만료',
  cancelled: '취소',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    expired: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const statusFilter = searchParams.status ?? ''
  const q = searchParams.q ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('enrollments')
    .select(
      'id, status, enrolled_at, expires_at, profiles(name, email), courses(title)',
      { count: 'exact' }
    )
    .order('enrolled_at', { ascending: false })
    .range(from, to)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: rawEnrollments, count } = await query
  const enrollments = rawEnrollments as unknown as {
    id: string
    status: string
    enrolled_at: string
    expires_at: string | null
    profiles: { name: string | null; email: string | null } | null
    courses: { title: string } | null
  }[] | null

  // Client-side search filter for q
  const filtered = q
    ? (enrollments ?? []).filter(
        (e) =>
          e.profiles?.name?.toLowerCase().includes(q.toLowerCase()) ||
          e.profiles?.email?.toLowerCase().includes(q.toLowerCase()) ||
          e.courses?.title?.toLowerCase().includes(q.toLowerCase())
      )
    : (enrollments ?? [])

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(p))
    return `/admin/enrollments?${params.toString()}`
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">수강 신청 현황</h1>
        <span className="text-sm text-gray-500">총 {count ?? 0}건</span>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 flex-wrap mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="수강자 또는 강좌명 검색"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        >
          <option value="">전체 상태</option>
          <option value="active">수강중</option>
          <option value="completed">수료</option>
          <option value="expired">만료</option>
          <option value="cancelled">취소</option>
        </select>
        <button
          type="submit"
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition"
        >
          검색
        </button>
        <Link
          href="/admin/enrollments"
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          초기화
        </Link>
      </form>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">수강자</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">강좌명</th>
              <th className="px-4 py-3 text-left font-semibold">신청일</th>
              <th className="px-4 py-3 text-left font-semibold">상태</th>
              <th className="px-4 py-3 text-left font-semibold">만료일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  수강 신청 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {e.profiles?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.profiles?.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{e.courses?.title ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {e.expires_at ? formatDate(e.expires_at) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-6">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              이전
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={pageUrl(p)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                  p === page
                    ? 'bg-[#2D7DD2] text-white border-[#2D7DD2]'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </Link>
            ))}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
