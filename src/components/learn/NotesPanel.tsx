'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, NotebookPen, Loader2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Note {
  id: string
  lesson_id: string
  course_id: string | null
  timestamp: number | null
  content: string
  created_at: string
  updated_at: string
}

interface Props {
  lessonId: string
  courseId: string
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function NotesPanel({ lessonId, courseId }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const confirm = useConfirm()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/notes?lessonId=${encodeURIComponent(lessonId)}`)
      .then((r) => r.json())
      .then((d) => {
        setNotes(d.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lessonId])

  async function handleAdd() {
    if (!content.trim()) return
    setPosting(true)
    setError('')
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, courseId, content: content.trim() }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? '저장 실패')
      } else {
        setNotes((prev) => [d.data, ...prev])
        setContent('')
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '노트 삭제',
      message: '이 노트를 삭제하시겠습니까? 되돌릴 수 없습니다.',
      variant: 'danger',
      confirmLabel: '삭제',
    })
    if (!ok) return
    const res = await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id))
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <NotebookPen className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-navy">학습 노트</h3>
        <span className="ml-auto text-xs text-gray-400">{notes.length}개</span>
      </div>

      <div className="border-b border-gray-100 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="이 강의에 대한 메모를 남겨보세요…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={posting || !content.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-light disabled:opacity-50 transition"
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            노트 추가
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            아직 노트가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="group rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  {typeof n.timestamp === 'number' && (
                    <span className="rounded-full bg-accent-pale px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {formatTime(n.timestamp)}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">{formatDate(n.created_at)}</span>
                  <button
                    onClick={() => handleDelete(n.id)}
                    aria-label="삭제"
                    className="ml-auto text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                  {n.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
