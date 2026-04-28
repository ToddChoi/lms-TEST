'use client'

import { useEffect, useState } from 'react'

interface Settings {
  site_name: string
  site_description: string
  main_color: string
  logo_url: string
}

const defaults: Settings = {
  site_name: '',
  site_description: '',
  main_color: '#2D7DD2',
  logo_url: '',
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          site_name: data.site_name ?? '',
          site_description: data.site_description ?? '',
          main_color: data.main_color ?? '#2D7DD2',
          logo_url: data.logo_url ?? '',
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3500)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    if (res.ok) {
      showToast('설정이 저장되었습니다.', 'success')
    } else {
      const data = await res.json()
      showToast(data.error ?? '저장 실패', 'error')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7DD2] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      {toast && (
        <div
          className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 text-sm font-medium transition ${
            toastType === 'success'
              ? 'bg-[#0B1F3A] text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-6">사이트 설정</h1>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사이트 이름</label>
          <input
            type="text"
            value={settings.site_name}
            onChange={(e) => setSettings((s) => ({ ...s, site_name: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            placeholder="예: Ingrow LMS"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사이트 설명</label>
          <textarea
            value={settings.site_description}
            onChange={(e) => setSettings((s) => ({ ...s, site_description: e.target.value }))}
            rows={3}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2] resize-none"
            placeholder="사이트에 대한 간략한 설명"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메인 컬러</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.main_color}
              onChange={(e) => setSettings((s) => ({ ...s, main_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={settings.main_color}
              onChange={(e) => setSettings((s) => ({ ...s, main_color: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 font-mono focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
              placeholder="#2D7DD2"
            />
            <div
              className="h-10 w-20 rounded-lg border border-gray-200"
              style={{ backgroundColor: settings.main_color }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">로고 URL</label>
          <input
            type="url"
            value={settings.logo_url}
            onChange={(e) => setSettings((s) => ({ ...s, logo_url: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            placeholder="https://..."
          />
          {settings.logo_url && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logo_url}
                alt="Logo preview"
                className="h-12 object-contain border border-gray-200 rounded-lg p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#2D7DD2] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
