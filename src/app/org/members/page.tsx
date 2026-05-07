import { requireManagerCompany } from '@/lib/org'
import Link from 'next/link'

export default async function OrgMembersPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const { supabase, companyId } = await requireManagerCompany()
  const q = (searchParams.q ?? '').trim()

  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('id, user_id, department, is_manager, profiles(id, name, email)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
  const membersRaw = rawMembers as unknown as {
    id: string
    user_id: string
    department: string | null
    is_manager: boolean
    profiles: { id: string; name: string | null; email: string | null } | null
  }[] | null

  let members = (membersRaw ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    department: m.department,
    is_manager: m.is_manager,
    name: m.profiles?.name ?? null,
    email: m.profiles?.email ?? null,
  }))

  if (q) {
    const qLower = q.toLowerCase()
    members = members.filter(
      (m) =>
        (m.name ?? '').toLowerCase().includes(qLower) ||
        (m.email ?? '').toLowerCase().includes(qLower)
    )
  }

  const userIds = members.map((m) => m.user_id)
  const enrollCount: Record<string, number> = {}
  const completedCount: Record<string, number> = {}

  if (userIds.length > 0) {
    const { data: rawEnrolls } = await supabase
      .from('enrollments')
      .select('user_id, status')
      .in('user_id', userIds)
    const enrolls = rawEnrolls as unknown as { user_id: string; status: string }[] | null
    ;(enrolls ?? []).forEach((e) => {
      enrollCount[e.user_id] = (enrollCount[e.user_id] ?? 0) + 1
      if (e.status === 'completed') {
        completedCount[e.user_id] = (completedCount[e.user_id] ?? 0) + 1
      }
    })
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-2">기업 회원</h1>
      <p className="text-sm text-gray-500 mb-6">총 {members.length}명</p>

      <form method="GET" className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 또는 이메일 검색"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
        <button
          type="submit"
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition"
        >
          검색
        </button>
        {q && (
          <Link
            href="/org/members"
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            초기화
          </Link>
        )}
      </form>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">이름</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">부서</th>
              <th className="px-4 py-3 text-center font-semibold">담당자</th>
              <th className="px-4 py-3 text-center font-semibold">수강</th>
              <th className="px-4 py-3 text-center font-semibold">수료</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  회원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{m.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{m.department ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {m.is_manager ? (
                      <span className="text-xs bg-[#2D7DD2] text-white px-2 py-0.5 rounded-full">담당자</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{enrollCount[m.user_id] ?? 0}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{completedCount[m.user_id] ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
