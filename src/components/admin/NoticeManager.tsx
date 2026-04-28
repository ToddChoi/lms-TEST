'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export interface Notice {
  id: string
  title: string
  content: string | null
  is_pinned: boolean
  is_active: boolean
  created_at: string
}

interface Props {
  initialNotices: Notice[]
}

interface FormState {
  title: string
  content: string
  is_pinned: boolean
  is_active: boolean
}

const emptyForm: FormState = { title: '', content: '', is_pinned: false, is_active: true }

export default function NoticeManager({ initialNotices }: Props) {
  const router = useRouter()
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(notice: Notice) {
    setEditing(notice)
    setForm({
      title: notice.title,
      content: notice.content ?? '',
      is_pinned: notice.is_pinned,
      is_active: notice.is_active,
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setError('제목을 입력하세요.'); return }
    setLoading(true)
    setError('')

    if (editing) {
      const res = await fetch('/api/admin/notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form }),
      })
      setLoading(false)
      if (res.ok) {
        setNotices((prev) =>
          prev.map((n) =>
            n.id === editing.id
              ? { ...n, title: form.title, content: form.content, is_pinned: form.is_pinned, is_active: form.is_active }
              : n
          )
        )
        setModalOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? '저장 실패')
      }
    } else {
      const res = await fetch('/api/admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setLoading(false)
      if (res.ok) {
        const data = await res.json()
        setNotices((prev) => [data.notice, ...prev])
        setModalOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? '추가 실패')
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return
    setLoading(true)
    const res = await fetch('/api/admin/notices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      setNotices((prev) => prev.filter((n) => n.id !== id))
      router.refresh()
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="bg-[#0B1F3A] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition"
        >
          + 공지 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">제목</th>
              <th className="px-4 py-3 text-center font-semibold">고정</th>
              <th className="px-4 py-3 text-center font-semibold">활성</th>
              <th className="px-4 py-3 text-left font-semibold">등록일</th>
              <th className="px-4 py-3 text-center font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  공지사항이 없습니다.
                </td>
              </tr>
            ) : (
              notices.map((n) => (
                <tr key={n.id} className="hover:bg-[#E8F2FC]/20 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A] max-w-xs truncate">
                    {n.is_pinned && (
                      <span className="inline-block mr-2 text-orange-500 text-xs font-bold">📌</span>
                    )}
                    {n.title}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {n.is_pinned ? <span className="text-orange-500 font-bold">✓</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {n.is_active ? <span className="text-green-500 font-bold">✓</span> : <span className="text-red-400 font-bold">✗</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(n.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openEdit(n)}
                        className="bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded text-xs hover:bg-[#2D7DD2] hover:text-white transition"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={loading}
                        className="bg-red-50 text-red-500 px-3 py-1 rounded text-xs hover:bg-red-500 hover:text-white transition disabled:opacity-60"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#0B1F3A]">
                {editing ? '공지 수정' : '공지 추가'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">제목 *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                  placeholder="공지사항 제목"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={5}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2] resize-none"
                  placeholder="공지 내용을 입력하세요."
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                    className="w-4 h-4 accent-[#2D7DD2]"
                  />
                  상단 고정
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 accent-[#2D7DD2]"
                  />
                  활성
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-[#2D7DD2] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-60"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
