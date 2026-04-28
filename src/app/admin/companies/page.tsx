import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function AdminCompaniesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCompanies, count } = await supabase
    .from('companies')
    .select('id, name, contact_name, contact_email, contract_start, contract_end, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  const companies = rawCompanies as unknown as {
    id: string
    name: string
    contact_name: string | null
    contact_email: string | null
    contract_start: string | null
    contract_end: string | null
    is_active: boolean
    created_at: string
  }[] | null

  // Member counts per company
  const memberCounts: Record<string, number> = {}
  for (const c of companies ?? []) {
    const { count: mc } = await supabase
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', c.id)
    memberCounts[c.id] = mc ?? 0
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">협약기업 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {count ?? 0}개 기업</p>
        </div>
        <Link
          href="/admin/companies/new"
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition"
        >
          + 새 기업
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">기업명</th>
              <th className="px-4 py-3 text-left font-semibold">담당자</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">계약기간</th>
              <th className="px-4 py-3 text-center font-semibold">회원 수</th>
              <th className="px-4 py-3 text-center font-semibold">활성</th>
              <th className="px-4 py-3 text-center font-semibold">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(companies ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  등록된 기업이 없습니다.
                </td>
              </tr>
            ) : (
              (companies ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.contact_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.contact_email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.contract_start ? formatDate(c.contract_start) : '-'}
                    {' ~ '}
                    {c.contract_end ? formatDate(c.contract_end) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {memberCounts[c.id] ?? 0}명
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.is_active ? (
                      <span className="text-green-500 font-bold">✓</span>
                    ) : (
                      <span className="text-red-400 font-bold">✗</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="inline-block bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded-lg text-xs font-medium hover:bg-[#2D7DD2] hover:text-white transition"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
