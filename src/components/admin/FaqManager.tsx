'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export interface Faq {
  id: number
  question: string
  answer: string
  category: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

interface Props {
  initialFaqs: Faq[]
}

interface FormState {
  question: string
  answer: string
  category: string
  sort_order: number
  is_active: boolean
}

const emptyForm: FormState = {
  question: '',
  answer: '',
  category: '',
  sort_order: 0,
  is_active: true,
}

export default function FaqManager({ initialFaqs }: Props) {
  const router = useRouter()
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Faq | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEdit(faq: Faq) {
    setEditing(faq)
    setForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category ?? '',
      sort_order: faq.sort_order,
      is_active: faq.is_active,
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.question.trim()) { setError('질문을 입력하세요.'); return }
    if (!form.answer.trim()) { setError('답변을 입력하세요.'); return }
    setLoading(true)
    setError('')

    if (editing) {
      const res = await fetch('/api/admin/faqs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form }),
      })
      setLoading(false)
      if (res.ok) {
        setFaqs((prev) =>
          prev.map((f) =>
            f.id === editing.id
              ? { ...f, ...form, category: form.category || null }
              : f
          )
        )
        setModalOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? '저장 실패')
      }
    } else {
      const res = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setLoading(false)
      if (res.ok) {
        const data = await res.json()
        setFaqs((prev) => [...prev, data.faq])
        setModalOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? '추가 실패')
      }
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return
    setLoading(true)
    const res = await fetch('/api/admin/faqs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      setFaqs((prev) => prev.filter((f) => f.id !== id))
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
          + FAQ 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-center font-semibold w-16">순서</th>
              <th className="px-4 py-3 text-left font-semibold">질문</th>
              <th className="px-4 py-3 text-left font-semibold">카테고리</th>
              <th className="px-4 py-3 text-center font-semibold">활성</th>
              <th className="px-4 py-3 text-left font-semibold">등록일</th>
              <th className="px-4 py-3 text-center font-semibold">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {faqs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  등록된 FAQ가 없습니다.
                </td>
              </tr>
            ) : (
              faqs.map((f) => (
                <tr key={f.id} className="hover:bg-[#E8F2FC]/20 transition">
                  <td className="px-4 py-3 text-center text-gray-500">{f.sort_order}</td>
                  <td className="px-4 py-3 font-medium text-[#0B1F3A] max-w-xs truncate">{f.question}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {f.category ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{f.category}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {f.is_active
                      ? <span className="text-green-500 font-bold">✓</span>
                      : <span className="text-red-400 font-bold">✗</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openEdit(f)}
                        className="bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded text-xs hover:bg-[#2D7DD2] hover:text-white transition"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#0B1F3A]">
                {editing ? 'FAQ 수정' : 'FAQ 추가'}
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
                <label className="block text-sm text-gray-600 mb-1">질문 *</label>
                <input
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                  placeholder="자주 묻는 질문을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">답변 *</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  rows={5}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2] resize-none"
                  placeholder="답변 내용을 입력하세요"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">카테고리</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                    placeholder="예: 수강 신청, 결제"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                    min={0}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-[#2D7DD2]"
                />
                활성 (공개 표시)
              </label>
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
