'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, GraduationCap, Loader2, Plus } from 'lucide-react'

interface Answer {
  id: string
  user_id: string
  content: string
  is_instructor_answer: boolean
  created_at: string
  profiles?: { name: string | null; avatar_url: string | null } | null
}

interface Question {
  id: string
  user_id: string
  title: string
  content: string
  is_resolved: boolean
  created_at: string
  profiles: { name: string | null; avatar_url: string | null } | null
  answers: Answer[]
}

interface Props {
  courseId: string
  currentUserId?: string | null
  isEnrolled: boolean
}

export function CourseQASection({ courseId, currentUserId, isEnrolled }: Props) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/questions?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setQuestions(d.data ?? []) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [courseId])

  async function handleSubmitQuestion() {
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용 모두 입력하세요.')
      return
    }
    setPosting(true); setError('')
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, title, content }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? '저장 실패')
      } else {
        setQuestions((prev) => [{ ...d.data, profiles: null, answers: [] }, ...prev])
        setTitle(''); setContent(''); setShowForm(false)
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold text-navy">Q&A</h2>
        <span className="text-sm text-gray-400">{questions.length}건</span>
      </div>

      {currentUserId && isEnrolled && (
        <div className="mb-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-accent bg-accent-pale px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
            >
              <Plus className="h-4 w-4" /> 질문 작성하기
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="질문 제목"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="질문 내용을 자세히 적어주세요."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowForm(false); setError('') }}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmitQuestion}
                  disabled={posting}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentUserId && !isEnrolled && (
        <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          수강 신청 후 질문할 수 있습니다.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-gray-200" />
          아직 등록된 질문이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((q) => (
            <QuestionItem
              key={q.id}
              q={q}
              currentUserId={currentUserId}
              onAnswer={(qid, ans) => {
                setQuestions((prev) =>
                  prev.map((p) => (p.id === qid ? { ...p, answers: [...p.answers, ans] } : p))
                )
              }}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function QuestionItem({
  q, currentUserId, onAnswer,
}: {
  q: Question
  currentUserId?: string | null
  onAnswer: (qid: string, ans: Answer) => void
}) {
  const [open, setOpen] = useState(false)
  const [answerContent, setAnswerContent] = useState('')
  const [posting, setPosting] = useState(false)

  async function submitAnswer() {
    if (!answerContent.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, content: answerContent }),
      })
      const d = await res.json()
      if (res.ok) {
        onAnswer(q.id, d.data)
        setAnswerContent('')
        setOpen(false)
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <li className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-semibold text-navy">{q.profiles?.name ?? '익명'}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-400">{new Date(q.created_at).toLocaleDateString()}</span>
        {q.answers.length > 0 && (
          <span className="ml-auto rounded-full bg-accent-pale px-2 py-0.5 text-[10px] font-semibold text-accent">
            답변 {q.answers.length}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-navy">{q.title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-gray-700 leading-relaxed">{q.content}</p>

      {/* 답변 목록 */}
      {q.answers.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-accent/30 pl-4">
          {q.answers.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="mb-0.5 flex items-center gap-1 text-xs">
                <span className="font-semibold text-navy">{a.profiles?.name ?? '익명'}</span>
                {a.is_instructor_answer && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-pale px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    <GraduationCap className="h-2.5 w-2.5" /> 강사
                  </span>
                )}
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <p className="whitespace-pre-line text-gray-700">{a.content}</p>
            </li>
          ))}
        </ul>
      )}

      {currentUserId && (
        <div className="mt-3">
          {!open ? (
            <button onClick={() => setOpen(true)} className="text-xs font-medium text-accent hover:underline">
              + 답변 작성
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={answerContent}
                onChange={(e) => setAnswerContent(e.target.value)}
                rows={3}
                placeholder="답변 내용"
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600">취소</button>
                <button onClick={submitAnswer} disabled={posting} className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-light disabled:opacity-50">
                  {posting ? '저장 중…' : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
