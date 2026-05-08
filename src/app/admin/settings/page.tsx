'use client'

import { useEffect, useState } from 'react'

type Group = 'general' | 'appearance' | 'contact'

interface AllSettings {
  // 일반
  site_name: string
  site_description: string
  // 디자인
  primary_color: string
  logo_url: string
  footer_text: string
  og_image_url: string
  favicon_url: string
  // 연락처
  contact_email: string
  contact_phone: string
  contact_address: string
  kakao_channel_url: string
}

const defaults: AllSettings = {
  site_name: '',
  site_description: '',
  primary_color: '#2D7DD2',
  logo_url: '',
  footer_text: 'Ingrow LMS. All rights reserved.',
  og_image_url: '',
  favicon_url: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  kakao_channel_url: '',
}

const GROUPS: { key: Group; label: string }[] = [
  { key: 'general', label: '일반' },
  { key: 'appearance', label: '디자인' },
  { key: 'contact', label: '연락처' },
]

const GROUP_KEYS: Record<Group, (keyof AllSettings)[]> = {
  general: ['site_name', 'site_description'],
  appearance: ['primary_color', 'logo_url', 'footer_text', 'og_image_url', 'favicon_url'],
  contact: ['contact_email', 'contact_phone', 'contact_address', 'kakao_channel_url'],
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AllSettings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [activeGroup, setActiveGroup] = useState<Group>('general')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          site_name: data.site_name ?? '',
          site_description: data.site_description ?? '',
          // 신규 키 우선, 구 키(main_color/footer_copyright)도 호환
          primary_color: data.primary_color ?? data.main_color ?? '#2D7DD2',
          logo_url: data.logo_url ?? '',
          footer_text: data.footer_text ?? data.footer_copyright ?? 'Ingrow LMS. All rights reserved.',
          og_image_url: data.og_image_url ?? '',
          favicon_url: data.favicon_url ?? '',
          contact_email: data.contact_email ?? '',
          contact_phone: data.contact_phone ?? '',
          contact_address: data.contact_address ?? '',
          kakao_channel_url: data.kakao_channel_url ?? '',
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

  function set(key: keyof AllSettings, value: string) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const keys = GROUP_KEYS[activeGroup]
    const payload = Object.fromEntries(keys.map((k) => [k, settings[k]]))
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[#2D7DD2] border-t-transparent rounded-full" />
      </div>
    )
  }

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      {toast && (
        <div
          className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 text-sm font-medium transition ${
            toastType === 'success' ? 'bg-[#0B1F3A] text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-6">사이트 설정</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setActiveGroup(g.key)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition ${
              activeGroup === g.key
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">

        {/* 일반 */}
        {activeGroup === 'general' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사이트 이름</label>
              <input
                type="text"
                value={settings.site_name}
                onChange={(e) => set('site_name', e.target.value)}
                className={inputCls}
                placeholder="예: Ingrow LMS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사이트 설명</label>
              <textarea
                value={settings.site_description}
                onChange={(e) => set('site_description', e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="사이트에 대한 간략한 설명"
              />
              <p className="text-xs text-gray-400 mt-1">검색엔진(SEO) 메타 설명으로 사용됩니다.</p>
            </div>
          </>
        )}

        {/* 디자인 */}
        {activeGroup === 'appearance' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메인 컬러</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_color}
                  onChange={(e) => set('primary_color', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={settings.primary_color}
                  onChange={(e) => set('primary_color', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 font-mono focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                  placeholder="#2D7DD2"
                />
                <div
                  className="h-10 w-20 rounded-lg border border-gray-200"
                  style={{ backgroundColor: settings.primary_color }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">로고 URL</label>
              <input
                type="url"
                value={settings.logo_url}
                onChange={(e) => set('logo_url', e.target.value)}
                className={inputCls}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">푸터 문구</label>
              <input
                type="text"
                value={settings.footer_text}
                onChange={(e) => set('footer_text', e.target.value)}
                className={inputCls}
                placeholder="Ingrow LMS. All rights reserved."
              />
              <p className="text-xs text-gray-400 mt-1">푸터 하단에 표시됩니다.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OG 이미지 URL</label>
              <input
                type="url"
                value={settings.og_image_url}
                onChange={(e) => set('og_image_url', e.target.value)}
                className={inputCls}
                placeholder="https://... (SNS 공유 시 표시되는 이미지)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">파비콘 URL</label>
              <input
                type="url"
                value={settings.favicon_url}
                onChange={(e) => set('favicon_url', e.target.value)}
                className={inputCls}
                placeholder="https://... (브라우저 탭 아이콘)"
              />
            </div>
          </>
        )}

        {/* 연락처 */}
        {activeGroup === 'contact' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대표 이메일</label>
              <input
                type="email"
                value={settings.contact_email}
                onChange={(e) => set('contact_email', e.target.value)}
                className={inputCls}
                placeholder="info@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대표 전화</label>
              <input
                type="tel"
                value={settings.contact_phone}
                onChange={(e) => set('contact_phone', e.target.value)}
                className={inputCls}
                placeholder="02-0000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={settings.contact_address}
                onChange={(e) => set('contact_address', e.target.value)}
                className={inputCls}
                placeholder="서울특별시 ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카카오 채널 URL</label>
              <input
                type="url"
                value={settings.kakao_channel_url}
                onChange={(e) => set('kakao_channel_url', e.target.value)}
                className={inputCls}
                placeholder="https://pf.kakao.com/..."
              />
              <p className="text-xs text-gray-400 mt-1">설정하면 푸터/문의 영역에서 카카오톡 채널 링크로 사용됩니다.</p>
            </div>
          </>
        )}

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
