'use client'

import { useState } from 'react'

interface Course {
  id: string
  title: string
}

interface UserRow {
  email: string
  name: string
  phone?: string
  company?: string
  department?: string
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = splitCSVLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

const USERS_TEMPLATE = 'email,name,phone,company,department\njohn@example.com,홍길동,010-1234-5678,ABC주식회사,영업팀\n'
const ENROLL_TEMPLATE = 'email\njohn@example.com\njane@example.com\n'

function templateDataUrl(csv: string) {
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
}

export function BulkUploader({ courses }: { courses: Course[] }) {
  const [tab, setTab] = useState<'users' | 'enrollments'>('users')

  return (
    <div>
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            tab === 'users'
              ? 'border-[#2D7DD2] text-[#2D7DD2]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          회원 생성
        </button>
        <button
          onClick={() => setTab('enrollments')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
            tab === 'enrollments'
              ? 'border-[#2D7DD2] text-[#2D7DD2]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          수강 신청 일괄 등록
        </button>
      </div>

      {tab === 'users' ? <UsersForm /> : <EnrollmentsForm courses={courses} />}
    </div>
  )
}

function UsersForm() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: { email: string; reason: string }[] } | null>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCSV(text) as unknown as UserRow[]
    setRows(parsed)
    setResult(null)
  }

  const onUpload = async () => {
    if (rows.length === 0) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/bulk/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      setResult(data)
    } catch (e: any) {
      alert(e.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[#0B1F3A]">회원 일괄 생성</h2>
          <p className="text-xs text-gray-500 mt-1">
            CSV 컬럼: email, name, phone, company, department
          </p>
        </div>
        <a
          href={templateDataUrl(USERS_TEMPLATE)}
          download="users_template.csv"
          className="text-xs text-[#2D7DD2] hover:underline"
        >
          샘플 다운로드
        </a>
      </div>

      <input type="file" accept=".csv" onChange={onFile} className="block text-sm mb-4" />
      {fileName && (
        <p className="text-xs text-gray-500 mb-3">
          파일: <span className="font-medium">{fileName}</span> · 총 {rows.length}건
        </p>
      )}

      {rows.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F4F6FA] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">email</th>
                <th className="px-3 py-2 text-left">name</th>
                <th className="px-3 py-2 text-left">phone</th>
                <th className="px-3 py-2 text-left">company</th>
                <th className="px-3 py-2 text-left">department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{r.email}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5">{r.phone}</td>
                  <td className="px-3 py-1.5">{r.company}</td>
                  <td className="px-3 py-1.5">{r.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <div className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50">
              외 {rows.length - 10}건…
            </div>
          )}
        </div>
      )}

      <button
        onClick={onUpload}
        disabled={loading || rows.length === 0}
        className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-50"
      >
        {loading ? '업로드 중...' : '업로드'}
      </button>

      {result && (
        <div className="mt-5 border-t border-gray-100 pt-4 text-sm">
          <p className="text-green-600 font-medium">성공: {result.success}건</p>
          {result.failed.length > 0 && (
            <>
              <p className="text-red-600 font-medium mt-2">실패: {result.failed.length}건</p>
              <ul className="text-xs text-gray-600 mt-2 list-disc pl-5 max-h-40 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    <span className="font-mono">{f.email}</span>: {f.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EnrollmentsForm({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [emails, setEmails] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: number; skipped: number; notFound: number } | null>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCSV(text)
    const extracted = parsed.map((r) => r.email).filter((e) => e && e.length > 0)
    setEmails(extracted)
    setResult(null)
  }

  const onUpload = async () => {
    if (!courseId || emails.length === 0) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/bulk/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, emails }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      setResult(data)
    } catch (e: any) {
      alert(e.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[#0B1F3A]">수강 신청 일괄 등록</h2>
          <p className="text-xs text-gray-500 mt-1">CSV 컬럼: email</p>
        </div>
        <a
          href={templateDataUrl(ENROLL_TEMPLATE)}
          download="enrollments_template.csv"
          className="text-xs text-[#2D7DD2] hover:underline"
        >
          샘플 다운로드
        </a>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">강좌 선택</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        >
          {courses.length === 0 && <option value="">등록된 강좌가 없습니다</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <input type="file" accept=".csv" onChange={onFile} className="block text-sm mb-4" />
      {fileName && (
        <p className="text-xs text-gray-500 mb-3">
          파일: <span className="font-medium">{fileName}</span> · 총 {emails.length}건
        </p>
      )}

      {emails.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto text-xs">
          {emails.slice(0, 10).map((e, i) => (
            <div key={i} className="py-0.5">{e}</div>
          ))}
          {emails.length > 10 && (
            <div className="text-gray-400">외 {emails.length - 10}건…</div>
          )}
        </div>
      )}

      <button
        onClick={onUpload}
        disabled={loading || emails.length === 0 || !courseId}
        className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-50"
      >
        {loading ? '처리 중...' : '등록'}
      </button>

      {result && (
        <div className="mt-5 border-t border-gray-100 pt-4 text-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">성공</p>
            <p className="text-xl font-bold text-green-700">{result.success}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">중복 스킵</p>
            <p className="text-xl font-bold text-gray-700">{result.skipped}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">회원 없음</p>
            <p className="text-xl font-bold text-red-700">{result.notFound}</p>
          </div>
        </div>
      )}
    </div>
  )
}
