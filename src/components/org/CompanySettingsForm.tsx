'use client'

import { useState } from 'react'
import { Loader2, Building2 } from 'lucide-react'

interface Props {
  companyId: string
  initialName: string
}

export function CompanySettingsForm({ companyId, initialName }: Props) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSave() {
    if (!name.trim()) {
      setResult({ ok: false, message: '회사명은 비울 수 없습니다.' })
      return
    }
    setSaving(true)
    setResult(null)
    const res = await fetch('/api/org/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: companyId, name: name.trim() }),
    })
    setSaving(false)
    const data = await res.json()
    if (res.ok) setResult({ ok: true, message: '저장되었습니다.' })
    else setResult({ ok: false, message: data.error ?? '저장 실패' })
  }

  return (
    <div className="max-w-lg rounded-2xl bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Building2 className="h-4 w-4 text-accent" /> 회사명
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-gray-400">
            기업 관리자 사이드바와 통계 페이지 등에 사용됩니다.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || name === initialName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            저장
          </button>
          {result && (
            <span className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
              {result.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
