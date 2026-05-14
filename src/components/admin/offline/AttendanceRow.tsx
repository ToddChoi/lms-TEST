'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

interface Props {
  index: number
  sessionDayId: string
  row: {
    enrollment_id: string
    attendee_id: string | null
    user_id: string | null
    name: string
    email: string | null
    department: string | null
    status: 'present' | 'absent' | 'late' | null
    checked_at: string | null
    checked_by: 'self_qr' | 'admin' | null
  }
}

type Status = 'present' | 'absent' | 'late'

const STATUS_LABEL: Record<Status | 'null', string> = {
  present: '출석',
  absent: '결석',
  late: '지각',
  null: '미체크',
}
const STATUS_CLASS: Record<Status, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
}

export function AttendanceRow({ index, sessionDayId, row }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(newStatus: Status) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/offline/attendance/${sessionDayId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollment_id: row.enrollment_id,
          attendee_id: row.attendee_id,
          user_id: row.attendee_id ? null : row.user_id,
          status: newStatus,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `처리 실패 (HTTP ${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '처리 중 오류')
      setSubmitting(false)
    }
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-silver/30">
      <td className="px-3 py-2 text-gray-500 text-xs">{index}</td>
      <td className="px-3 py-2 font-medium text-navy">{row.name}</td>
      <td className="px-3 py-2 text-gray-600 text-xs">{row.email ?? '-'}</td>
      <td className="px-3 py-2 text-gray-600 text-xs">{row.department ?? '-'}</td>
      <td className="px-3 py-2">
        {row.status ? (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[row.status]}`}>
            {STATUS_LABEL[row.status]}
          </span>
        ) : (
          <span className="text-xs text-gray-400">{STATUS_LABEL.null}</span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-500 text-xs">
        {row.checked_at
          ? new Date(row.checked_at).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              timeZone: 'Asia/Seoul',
            })
          : '-'}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.checked_by === 'self_qr' ? (
          <span className="text-blue-600">QR</span>
        ) : row.checked_by === 'admin' ? (
          <span className="text-gray-600">관리자</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {submitting ? (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setStatus('present')}
              className={`rounded p-1 ${row.status === 'present' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
              title="출석"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStatus('late')}
              className={`rounded p-1 ${row.status === 'late' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600'}`}
              title="지각"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStatus('absent')}
              className={`rounded p-1 ${row.status === 'absent' ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
              title="결석"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </td>
    </tr>
  )
}
