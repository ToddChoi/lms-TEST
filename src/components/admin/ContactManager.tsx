'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export interface Contact {
  id: string
  user_id: string | null
  title: string
  content: string
  status: 'pending' | 'answered'
  answer: string | null
  answered_at: string | null
  created_at: string
}

interface Props {
  initialContacts: Contact[]
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: '미답변', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  answered: { label: '답변완료', className: 'bg-green-50 text-green-700 border border-green-200' },
}

export default function ContactManager({ initialContacts }: Props) {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all')

  const filtered = contacts.filter((c) => filter === 'all' || c.status === filter)

  function openDetail(contact: Contact) {
    setSelected(contact)
    setAnswer(contact.answer ?? '')
  }

  async function handleAnswer() {
    if (!selected) return
    setLoading(true)
    const res = await fetch('/api/admin/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        status: answer.trim() ? 'answered' : 'pending',
        answer: answer.trim() || null,
      }),
    })
    setLoading(false)
    if (res.ok) {
      const newStatus = answer.trim() ? 'answered' : 'pending'
      const now = new Date().toISOString()
      setContacts((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, status: newStatus, answer: answer.trim() || null, answered_at: answer.trim() ? now : null }
            : c
        )
      )
      setSelected((prev) =>
        prev
          ? { ...prev, status: newStatus, answer: answer.trim() || null, answered_at: answer.trim() ? now : null }
          : null
      )
      router.refresh()
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Left: list */}
      <div className="flex-1 min-w-0">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'answered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                filter === f
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '전체' : f === 'pending' ? '미답변' : '답변완료'}
              <span className="ml-1.5 text-xs opacity-70">
                {f === 'all' ? contacts.length : contacts.filter((c) => c.status === f).length}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">제목</th>
                <th className="px-4 py-3 text-center font-semibold w-24">상태</th>
                <th className="px-4 py-3 text-left font-semibold w-28">접수일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    문의가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={`cursor-pointer transition ${
                      selected?.id === c.id
                        ? 'bg-[#E8F2FC]/40'
                        : 'hover:bg-[#E8F2FC]/20'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-[#0B1F3A] max-w-xs truncate">
                      {c.title}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[c.status]?.className ?? ''}`}>
                        {STATUS_LABELS[c.status]?.label ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-96 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4 self-start sticky top-0">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-[#0B1F3A] leading-snug">{selected.title}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0"
            >
              ×
            </button>
          </div>

          <div className="text-xs text-gray-400">
            접수일: {formatDate(selected.created_at)}
            {selected.answered_at && ` · 답변일: ${formatDate(selected.answered_at)}`}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {selected.content}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">답변</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2] resize-none"
              placeholder="답변 내용을 입력하세요."
            />
          </div>

          <button
            onClick={handleAnswer}
            disabled={loading}
            className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-60"
          >
            {loading ? '저장 중...' : answer.trim() ? '답변 저장' : '미답변으로 변경'}
          </button>
        </div>
      )}
    </div>
  )
}
