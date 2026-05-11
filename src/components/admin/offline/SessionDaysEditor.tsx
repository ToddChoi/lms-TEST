'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OfflineSessionDay } from '@/types/database'
import { Plus, Trash2, Save, Copy, Check } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
  sessionId: string
  initial: OfflineSessionDay[]
}

interface DraftDay {
  // existing days have id; new (unsaved) drafts don't
  id?: string
  day_number: number
  date: string
  start_time: string  // HH:MM (form input)
  end_time: string
  topic: string
  qr_token?: string
  qr_active_from?: string
  qr_active_until?: string
}

function fromRow(d: OfflineSessionDay): DraftDay {
  return {
    id: d.id,
    day_number: d.day_number,
    date: d.date,
    // DB 가 HH:MM:SS — input[type=time] 은 HH:MM 만 받음
    start_time: d.start_time.slice(0, 5),
    end_time: d.end_time.slice(0, 5),
    topic: d.topic ?? '',
    qr_token: d.qr_token,
    qr_active_from: d.qr_active_from,
    qr_active_until: d.qr_active_until,
  }
}

function emptyDraft(nextNumber: number): DraftDay {
  return {
    day_number: nextNumber,
    date: '',
    start_time: '10:00',
    end_time: '17:00',
    topic: '',
  }
}

export function SessionDaysEditor({ sessionId, initial }: Props) {
  const router = useRouter()
  const [days, setDays] = useState<DraftDay[]>(initial.map(fromRow))
  const [busy, setBusy] = useState<string | null>(null) // dayKey or 'new'
  const [error, setError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  function updateDay(idx: number, patch: Partial<DraftDay>) {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  async function saveExisting(idx: number) {
    const d = days[idx]
    if (!d.id) return
    if (!d.date) {
      setError('날짜를 입력하세요.')
      return
    }
    if (d.end_time <= d.start_time) {
      setError('종료 시간이 시작 시간보다 빨라요.')
      return
    }
    setBusy(d.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/sessions/${sessionId}/days/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: d.day_number,
          date: d.date,
          start_time: d.start_time,
          end_time: d.end_time,
          topic: d.topic.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `저장 실패 (HTTP ${res.status})`)
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '저장 중 오류')
    } finally {
      setBusy(null)
    }
  }

  async function deleteExisting(idx: number) {
    const d = days[idx]
    if (!d.id) {
      // 미저장 draft — 단순 제거
      setDays((prev) => prev.filter((_, i) => i !== idx))
      return
    }
    if (!confirm(`${d.day_number}일차 (${d.date})를 삭제하시겠습니까?`)) return
    setBusy(d.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/sessions/${sessionId}/days/${d.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `삭제 실패 (HTTP ${res.status})`)
      }
      setDays((prev) => prev.filter((_, i) => i !== idx))
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '삭제 중 오류')
    } finally {
      setBusy(null)
    }
  }

  function addDraft() {
    const maxNum = days.reduce((m, d) => Math.max(m, d.day_number), 0)
    setDays((prev) => [...prev, emptyDraft(maxNum + 1)])
  }

  async function saveDraft(idx: number) {
    const d = days[idx]
    if (d.id) return
    if (!d.date) {
      setError('날짜를 입력하세요.')
      return
    }
    if (d.end_time <= d.start_time) {
      setError('종료 시간이 시작 시간보다 빨라요.')
      return
    }
    setBusy('new')
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/sessions/${sessionId}/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: d.day_number,
          date: d.date,
          start_time: d.start_time,
          end_time: d.end_time,
          topic: d.topic.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `생성 실패 (HTTP ${res.status})`)
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '생성 중 오류')
    } finally {
      setBusy(null)
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {days.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          회차 일자가 없습니다. 첫 일자를 추가하세요.
        </p>
      )}

      {days.map((d, idx) => {
        const isNew = !d.id
        const isBusy = (isNew && busy === 'new') || (d.id && busy === d.id)
        return (
          <div
            key={d.id ?? `draft-${idx}`}
            className={`rounded-xl border p-4 ${
              isNew ? 'border-dashed border-accent/40 bg-accent-pale/40' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[80px_140px_110px_110px_1fr_auto]">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500">일차</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={d.day_number}
                  onChange={(e) => updateDay(idx, { day_number: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500">날짜</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={d.date}
                  onChange={(e) => updateDay(idx, { date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500">시작</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={d.start_time}
                  onChange={(e) => updateDay(idx, { start_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500">종료</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={d.end_time}
                  onChange={(e) => updateDay(idx, { end_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500">주제</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  value={d.topic}
                  onChange={(e) => updateDay(idx, { topic: e.target.value })}
                  placeholder="이 일자의 학습 주제"
                />
              </div>
              <div className="flex items-end gap-1">
                <button
                  type="button"
                  onClick={() => (isNew ? saveDraft(idx) : saveExisting(idx))}
                  disabled={!!isBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-light disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isBusy ? '...' : isNew ? '생성' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteExisting(idx)}
                  disabled={!!isBusy}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isNew && d.qr_token && (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-500">QR 토큰</span>
                  <code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[11px] text-gray-700">
                    {d.qr_token}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToken(d.qr_token!)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {copiedToken === d.qr_token ? (
                      <><Check className="h-3 w-3" /> 복사됨</>
                    ) : (
                      <><Copy className="h-3 w-3" /> 복사</>
                    )}
                  </button>
                </div>
                {d.qr_active_from && d.qr_active_until && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    활성: {formatDate(d.qr_active_from)} {new Date(d.qr_active_from).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(d.qr_active_until).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addDraft}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" /> 일자 추가
      </button>
    </div>
  )
}
