'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ChevronDown, ChevronUp, Save } from 'lucide-react'

export interface HomeSection {
  id: number
  section_key: string
  title: string | null
  is_visible: boolean
  sort_order: number
  config: Record<string, unknown>
}

interface Props {
  initialSections: HomeSection[]
}

const SECTION_LABELS: Record<string, string> = {
  hero: '히어로',
  stats: '통계',
  featured_courses: '추천 강좌',
  b2b_cta: 'B2B CTA',
}

// hero 섹션 필드 목록
const HERO_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'badge', label: '배지 텍스트', type: 'text', placeholder: 'AI·실무 역량 강화 플랫폼' },
  { key: 'heading_line1', label: '제목 1줄', type: 'text', placeholder: '성장하는 사람들의' },
  { key: 'heading_line2', label: '제목 2줄 (강조)', type: 'text', placeholder: '이러닝 플랫폼' },
  { key: 'subtext', label: '설명 문구', type: 'textarea', placeholder: 'AI 활용부터 실무 역량까지...' },
  { key: 'cta_primary_label', label: '버튼1 텍스트', type: 'text', placeholder: '강좌 둘러보기' },
  { key: 'cta_primary_href', label: '버튼1 링크', type: 'text', placeholder: '/courses' },
  { key: 'cta_secondary_label', label: '버튼2 텍스트', type: 'text', placeholder: '기업 도입 문의' },
  { key: 'cta_secondary_href', label: '버튼2 링크', type: 'text', placeholder: '/b2b' },
]

const FEATURED_FIELDS: { key: string; label: string; type: 'text' | 'number'; placeholder?: string }[] = [
  { key: 'title', label: '섹션 제목', type: 'text', placeholder: '추천 강좌' },
  { key: 'subtitle', label: '섹션 부제', type: 'text', placeholder: '지금 인기 있는 강좌를 만나보세요' },
  { key: 'limit', label: '최대 표시 개수', type: 'number', placeholder: '6' },
]

const B2B_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'heading_line1', label: '제목 1줄', type: 'text', placeholder: '임직원 교육,' },
  { key: 'heading_line2', label: '제목 2줄', type: 'text', placeholder: '이제 Ingrow LMS로 한 번에' },
  { key: 'subtext', label: '설명 문구', type: 'textarea', placeholder: '기업 맞춤형 커리큘럼...' },
  { key: 'cta_label', label: 'CTA 버튼 텍스트', type: 'text', placeholder: '기업 도입 상담 신청' },
  { key: 'cta_href', label: 'CTA 버튼 링크', type: 'text', placeholder: '/b2b' },
]

function SectionCard({ section, onUpdate }: { section: HomeSection; onUpdate: (id: number, updates: Partial<HomeSection>) => void }) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<Record<string, unknown>>(section.config ?? {})
  const [benefits, setBenefits] = useState<string[]>(
    Array.isArray((section.config as any)?.benefits) ? (section.config as any).benefits : []
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function setConfigField(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const finalConfig = section.section_key === 'b2b_cta'
      ? { ...config, benefits }
      : config

    const res = await fetch('/api/admin/home-sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: section.id, config: finalConfig }),
    })
    setSaving(false)
    if (res.ok) {
      onUpdate(section.id, { config: finalConfig })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleToggleVisible() {
    const res = await fetch('/api/admin/home-sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: section.id, is_visible: !section.is_visible }),
    })
    if (res.ok) {
      onUpdate(section.id, { is_visible: !section.is_visible })
    }
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div className={`bg-white rounded-xl border ${section.is_visible ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-60'} shadow-sm overflow-hidden`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
            {section.section_key}
          </span>
          <span className="font-semibold text-[#0B1F3A]">
            {section.title ?? SECTION_LABELS[section.section_key] ?? section.section_key}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            section.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {section.is_visible ? '표시' : '숨김'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleVisible}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${
              section.is_visible
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {section.is_visible
              ? <><EyeOff className="h-3.5 w-3.5" /> 숨기기</>
              : <><Eye className="h-3.5 w-3.5" /> 표시</>
            }
          </button>
          {section.section_key !== 'stats' && (
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#E8F2FC] text-[#2D7DD2] rounded-lg hover:bg-[#2D7DD2] hover:text-white transition"
            >
              편집
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 편집 패널 */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {/* Hero 섹션 */}
          {section.section_key === 'hero' && HERO_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={String(config[f.key] ?? '')}
                  onChange={(e) => setConfigField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              ) : (
                <input
                  type="text"
                  value={String(config[f.key] ?? '')}
                  onChange={(e) => setConfigField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              )}
            </div>
          ))}

          {/* Featured Courses 섹션 */}
          {section.section_key === 'featured_courses' && FEATURED_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={String(config[f.key] ?? '')}
                onChange={(e) => setConfigField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}

          {/* B2B CTA 섹션 */}
          {section.section_key === 'b2b_cta' && (
            <>
              {B2B_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={String(config[f.key] ?? '')}
                      onChange={(e) => setConfigField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(config[f.key] ?? '')}
                      onChange={(e) => setConfigField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}

              {/* Benefits 리스트 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">혜택 목록</label>
                <div className="space-y-1.5">
                  {benefits.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={b}
                        onChange={(e) => {
                          const next = [...benefits]
                          next[i] = e.target.value
                          setBenefits(next)
                        }}
                        className={inputCls}
                        placeholder={`혜택 ${i + 1}`}
                      />
                      <button
                        onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-xs px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBenefits([...benefits, ''])}
                    className="text-xs text-[#2D7DD2] hover:underline"
                  >
                    + 혜택 추가
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomeSectionManager({ initialSections }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<HomeSection[]>(initialSections)

  function handleUpdate(id: number, updates: Partial<HomeSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  )
}
