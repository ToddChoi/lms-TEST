import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export default async function AdminCertificatesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCerts, count } = await supabase
    .from('certificates')
    .select(
      'id, cert_number, issued_at, pdf_url, profiles(name, email), courses(title)',
      { count: 'exact' }
    )
    .order('issued_at', { ascending: false })
  const certs = rawCerts as unknown as {
    id: string
    cert_number: string
    issued_at: string
    pdf_url: string | null
    profiles: { name: string | null; email: string | null } | null
    courses: { title: string } | null
  }[] | null

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">수료증 발급 현황</h1>
        <span className="text-sm text-gray-500">총 {count ?? 0}건</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">수강자</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">강좌명</th>
              <th className="px-4 py-3 text-left font-semibold">수료증 번호</th>
              <th className="px-4 py-3 text-left font-semibold">발급일</th>
              <th className="px-4 py-3 text-center font-semibold">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(certs ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  발급된 수료증이 없습니다.
                </td>
              </tr>
            ) : (
              (certs ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {c.profiles?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.profiles?.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.courses?.title ?? '-'}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                      {c.cert_number}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.issued_at)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.pdf_url ? (
                      <a
                        href={c.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded-lg text-xs font-medium hover:bg-[#2D7DD2] hover:text-white transition"
                      >
                        PDF
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">미생성</span>
                    )}
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
