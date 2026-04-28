'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  user_id: string
  department: string | null
  is_manager: boolean
  name: string | null
  email: string | null
}

interface CompanyMemberManagerProps {
  companyId: string
  initialMembers: Member[]
}

export function CompanyMemberManager({ companyId, initialMembers }: CompanyMemberManagerProps) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMember = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, department, is_manager: isManager }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '추가 실패')
      setMembers((prev) => [...prev, data.member])
      setEmail('')
      setDepartment('')
      setIsManager(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleManager = async (memberId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, is_manager: !current }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? '변경 실패')
      }
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, is_manager: !current } : m))
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('이 회원을 기업에서 제외하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? '삭제 실패')
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">이름</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">부서</th>
              <th className="px-4 py-3 text-center font-semibold">담당자</th>
              <th className="px-4 py-3 text-center font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  등록된 회원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{m.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{m.department ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleManager(m.id, m.is_manager)}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        m.is_manager
                          ? 'bg-[#2D7DD2] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m.is_manager ? '담당자' : '일반'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      제외
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-[#F4F6FA] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[#0B1F3A] mb-3">회원 추가</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-600 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-600 mb-1">부서</label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="부서명"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A] pb-2">
            <input
              type="checkbox"
              checked={isManager}
              onChange={(e) => setIsManager(e.target.checked)}
              className="rounded"
            />
            담당자
          </label>
          <button
            onClick={addMember}
            disabled={loading}
            className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-50"
          >
            {loading ? '추가 중...' : '추가'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  )
}
