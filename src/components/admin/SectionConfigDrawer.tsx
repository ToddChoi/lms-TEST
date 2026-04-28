'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import CmsBannerManager from './CmsBannerManager'
import { SECTION_TYPES } from './AddSectionModal'

export interface CmsHomeSection {
  id: string
  type: string
  label: string
  title: string | null
  subtitle: string | null
  sort_order: number
  is_visible: boolean
  config: Record<string, unknown>
}

interface Props {
  section: CmsHomeSection
  onClose: () => void
  onUpdate: (id: string, updates: Partial<CmsHomeSection>) => void
}

export default function SectionConfigDrawer({ section, onClose, onUpdate }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(section.config ?? {})
  const [label, setLabel] = useState(section.label)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const typeInfo = SECTION_TYPES.find((t) => t.type === section.type)

  function setCfg(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/admin/cms/sections/${section.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, config }),
    })
    setSaving(false)
    if (res.ok) {
      onUpdate(section.id, { label, config })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'
  const textareaCls = `${inputCls} resize-none`

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* 드로어 패널 */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                {typeInfo?.emoji} {section.type}
              </span>
              <span className="font-semibold text-[#0B1F3A]">{section.label}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">섹션 설정</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 공통: 라벨 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">관리자 라벨</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="관리자 식별용 이름" />
          </div>

          {/* ── hero ── */}
          {section.type === 'hero' && (
            <>
              <Field label="헤딩">
                <input type="text" value={str(config.heading)} onChange={(e) => setCfg('heading', e.target.value)} placeholder="성장하는 사람들의 이러닝 플랫폼" className={inputCls} />
              </Field>
              <Field label="서브 헤딩">
                <textarea rows={2} value={str(config.subheading)} onChange={(e) => setCfg('subheading', e.target.value)} placeholder="AI 활용부터 실무 역량까지..." className={textareaCls} />
              </Field>
              <Field label="CTA 버튼 텍스트">
                <input type="text" value={str(config.cta_label)} onChange={(e) => setCfg('cta_label', e.target.value)} placeholder="강좌 둘러보기" className={inputCls} />
              </Field>
              <Field label="CTA 버튼 링크">
                <input type="text" value={str(config.cta_url)} onChange={(e) => setCfg('cta_url', e.target.value)} placeholder="/courses" className={inputCls} />
              </Field>
              <Field label="보조 버튼 텍스트">
                <input type="text" value={str(config.cta_secondary_label)} onChange={(e) => setCfg('cta_secondary_label', e.target.value)} placeholder="기업 도입 문의" className={inputCls} />
              </Field>
              <Field label="보조 버튼 링크">
                <input type="text" value={str(config.cta_secondary_url)} onChange={(e) => setCfg('cta_secondary_url', e.target.value)} placeholder="/b2b" className={inputCls} />
              </Field>
              <Field label="배경 이미지 URL (선택)">
                <input type="url" value={str(config.background_image_url)} onChange={(e) => setCfg('background_image_url', e.target.value)} placeholder="https://..." className={inputCls} />
              </Field>
            </>
          )}

          {/* ── banner ── */}
          {section.type === 'banner' && (
            <>
              <Field label="자동 슬라이드">
                <Toggle value={!!config.autoplay} onChange={(v) => setCfg('autoplay', v)} />
              </Field>
              <Field label="슬라이드 간격 (ms)">
                <input type="number" value={num(config.interval, 5000)} onChange={(e) => setCfg('interval', Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="좌우 화살표 표시">
                <Toggle value={!!config.show_arrows} onChange={(v) => setCfg('show_arrows', v)} />
              </Field>
              <Field label="도트 인디케이터 표시">
                <Toggle value={!!config.show_dots} onChange={(v) => setCfg('show_dots', v)} />
              </Field>
            </>
          )}

          {/* ── featured_courses ── */}
          {section.type === 'featured_courses' && (
            <>
              <Field label="섹션 제목">
                <input type="text" value={str(config.title)} onChange={(e) => setCfg('title', e.target.value)} placeholder="추천 강좌" className={inputCls} />
              </Field>
              <Field label="섹션 부제">
                <input type="text" value={str(config.subtitle)} onChange={(e) => setCfg('subtitle', e.target.value)} placeholder="지금 인기 있는 강좌를 만나보세요" className={inputCls} />
              </Field>
              <Field label="최대 표시 수">
                <input type="number" value={num(config.limit, 6)} onChange={(e) => setCfg('limit', Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="정렬 기준">
                <select value={str(config.filter) || 'is_featured'} onChange={(e) => setCfg('filter', e.target.value)} className={inputCls}>
                  <option value="is_featured">추천 강좌</option>
                  <option value="latest">최신순</option>
                </select>
              </Field>
            </>
          )}

          {/* ── categories ── */}
          {section.type === 'categories' && (
            <>
              <Field label="섹션 제목">
                <input type="text" value={str(config.title)} onChange={(e) => setCfg('title', e.target.value)} placeholder="카테고리" className={inputCls} />
              </Field>
              <Field label="최대 표시 수">
                <input type="number" value={num(config.limit, 8)} onChange={(e) => setCfg('limit', Number(e.target.value))} className={inputCls} />
              </Field>
            </>
          )}

          {/* ── stats ── */}
          {section.type === 'stats' && (
            <>
              <Field label="누적 수강생 표시">
                <Toggle value={!!config.show_students} onChange={(v) => setCfg('show_students', v)} />
              </Field>
              {!!config.show_students && (
                <Field label="수강생 수 수동 입력 (비워두면 DB 집계)">
                  <input type="number" value={str(config.manual_students)} onChange={(e) => setCfg('manual_students', e.target.value ? Number(e.target.value) : '')} placeholder="예) 1200" className={inputCls} />
                </Field>
              )}
              <Field label="전체 강좌 수 표시">
                <Toggle value={!!config.show_courses} onChange={(v) => setCfg('show_courses', v)} />
              </Field>
              {!!config.show_courses && (
                <Field label="강좌 수 수동 입력">
                  <input type="number" value={str(config.manual_courses)} onChange={(e) => setCfg('manual_courses', e.target.value ? Number(e.target.value) : '')} placeholder="예) 50" className={inputCls} />
                </Field>
              )}
              <Field label="파트너 기업 수 표시">
                <Toggle value={!!config.show_companies} onChange={(v) => setCfg('show_companies', v)} />
              </Field>
              {!!config.show_companies && (
                <Field label="기업 수 수동 입력">
                  <input type="number" value={str(config.manual_companies)} onChange={(e) => setCfg('manual_companies', e.target.value ? Number(e.target.value) : '')} placeholder="예) 30" className={inputCls} />
                </Field>
              )}
            </>
          )}

          {/* ── custom_html ── */}
          {section.type === 'custom_html' && (
            <Field label="HTML 코드">
              <textarea
                rows={8}
                value={str(config.html)}
                onChange={(e) => setCfg('html', e.target.value)}
                placeholder="<div>직접 HTML을 입력하세요</div>"
                className={`${textareaCls} font-mono text-xs`}
              />
              <p className="text-xs text-amber-600 mt-1">⚠️ XSS 방지를 위해 스크립트 태그는 렌더링 시 제거됩니다.</p>
            </Field>
          )}

          {/* banner 타입 → BannerManager 통합 */}
          {section.type === 'banner' && (
            <CmsBannerManager sectionId={section.id} />
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#2D7DD2] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : saved ? '저장됨 ✓' : '설정 저장'}
          </button>
        </div>
      </div>
    </>
  )
}

// 유틸
function str(v: unknown): string { return v != null ? String(v) : '' }
function num(v: unknown, def = 0): number { return typeof v === 'number' ? v : def }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? 'bg-[#2D7DD2]' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
