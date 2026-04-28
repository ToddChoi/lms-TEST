'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'

interface Profile {
  id: string
  name: string | null
  email: string | null
  role: string
  phone: string | null
  company: string | null
  department: string | null
  is_active: boolean
  created_at: string
}

interface Enrollment {
  id: string
  status: string
  enrolled_at: string
  expires_at: string | null
  progress_percent: number
  courses: {
    title: string
  } | null
}

const ROLES = ['student', 'instructor', 'admin', 'superadmin']
const ROLE_LABELS: Record<string, string> = {
  student: '학생',
  instructor: '강사',
  admin: '관리자',
  superadmin: '최고관리자',
}

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

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/users/${userId}/role`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        setEnrollments(data.enrollments ?? [])
        setRole(data.profile.role)
        setIsActive(data.profile.is_active)
      }
      setLoading(false)
    }
    load()
  }, [userId])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, isActive }),
    })
    setSaving(false)
    if (res.ok) {
      setToast('저장되었습니다.')
      setTimeout(() => setToast(''), 3000)
      router.refresh()
    } else {
      setToast('저장 실패')
      setTimeout(() => setToast(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7DD2] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-8">
        <p className="text-gray-500">회원을 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {toast && (
        <div className="fixed top-6 right-6 bg-[#0B1F3A] text-white px-5 py-3 rounded-xl shadow-lg z-50 text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ← 목록
        </button>
        <h1 className="text-2xl font-bold text-[#0B1F3A]">회원 상세</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-4">기본 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block mb-1">이름</span>
            <span className="font-medium text-[#0B1F3A]">{profile.name ?? '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">이메일</span>
            <span className="font-medium text-[#0B1F3A]">{profile.email ?? '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">전화번호</span>
            <span className="font-medium text-[#0B1F3A]">{profile.phone ?? '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">가입일</span>
            <span className="font-medium text-[#0B1F3A]">{formatDate(profile.created_at)}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">회사</span>
            <span className="font-medium text-[#0B1F3A]">{profile.company ?? '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">부서</span>
            <span className="font-medium text-[#0B1F3A]">{profile.department ?? '-'}</span>
          </div>
        </div>
      </div>

      {/* User Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-4">권한 및 상태 관리</h2>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm text-gray-500 mb-1">역할</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">활성</label>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                isActive ? 'bg-[#2D7DD2]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium">{isActive ? '활성' : '비활성'}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#2D7DD2] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Enrollments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#0B1F3A]">수강 내역 ({enrollments.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">강좌명</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">신청일</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">상태</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">진도율</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">만료일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  수강 내역이 없습니다.
                </td>
              </tr>
            ) : (
              enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {e.courses?.title ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2D7DD2] rounded-full"
                          style={{ width: `${e.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{e.progress_percent}%</span>
                    </div>
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
    </div>
  )
}
