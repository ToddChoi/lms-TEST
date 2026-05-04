import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Suspense } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'

const PAGE_SIZE = 20

function roleBadge(role: string) {
  const map: Record<string, string> = {
    student: 'bg-gray-100 text-gray-700',
    instructor: 'bg-blue-100 text-blue-700',
    org_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-orange-100 text-orange-700',
    superadmin: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    student: '학생',
    instructor: '강사',
    org_admin: '기업 매니저',
    admin: '관리자',
    superadmin: '최고관리자',
  }
  const cls = map[role] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {labels[role] ?? role}
    </span>
  )
}

function SearchForm({ q, role }: { q: string; role: string }) {
  return (
    <form method="GET" className="flex gap-3 flex-wrap">
      <input
        name="q"
        defaultValue={q}
        placeholder="이름 또는 이메일 검색"
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
      />
      <select
        name="role"
        defaultValue={role}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
      >
        <option value="">전체 역할</option>
        <option value="student">학생</option>
        <option value="instructor">강사</option>
        <option value="org_admin">기업 매니저</option>
        <option value="admin">관리자</option>
        <option value="superadmin">최고관리자</option>
      </select>
      <button
        type="submit"
        className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition"
      >
        검색
      </button>
      <Link
        href="/admin/users"
        className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
      >
        초기화
      </Link>
    </form>
  )
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; page?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const q = searchParams.q ?? ''
  const roleFilter = searchParams.role ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('profiles')
    .select('id, name, email, role, phone, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }

  const { data: rawUsers, count } = await query
  const users = rawUsers as unknown as {
    id: string
    name: string | null
    email: string | null
    role: string
    phone: string | null
    is_active: boolean
    created_at: string
  }[] | null

  const total = count ?? 0
  const isFiltered = !!q || !!roleFilter

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">회원 관리</h1>
        <span className="text-sm text-gray-500">총 {count ?? 0}명</span>
      </div>

      <div className="mb-5">
        <Suspense fallback={null}>
          <SearchForm q={q} role={roleFilter} />
        </Suspense>
      </div>

      {(users ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title={isFiltered ? '검색 결과가 없습니다' : '아직 등록된 회원이 없습니다'}
          description={
            isFiltered
              ? '다른 검색어를 시도하거나 필터를 초기화해보세요.'
              : '회원이 가입하면 이곳에 표시됩니다.'
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">이름</th>
                  <th className="px-4 py-3 text-left font-semibold">이메일</th>
                  <th className="px-4 py-3 text-left font-semibold">역할</th>
                  <th className="px-4 py-3 text-left font-semibold">가입일</th>
                  <th className="px-4 py-3 text-center font-semibold">활성</th>
                  <th className="px-4 py-3 text-center font-semibold">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="hover:bg-[#E8F2FC]/30 transition">
                    <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                      {u.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email ?? '-'}</td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {u.is_active ? (
                        <span className="text-green-500 font-bold">✓</span>
                      ) : (
                        <span className="text-red-400 font-bold">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-block bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded-lg text-xs font-medium hover:bg-[#2D7DD2] hover:text-white transition"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <Pagination totalCount={total} pageSize={PAGE_SIZE} />
          </div>
        </>
      )}
    </div>
  )
}
