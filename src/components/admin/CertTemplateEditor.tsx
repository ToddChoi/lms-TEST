'use client'

/**
 * 수료증 템플릿 편집기.
 *
 * 좌: element 목록 + 추가/삭제/위↑↓ + 선택된 element 의 속성 폼
 * 우: 미리보기 canvas (HTML mock — PDF 와 1:1 좌표 매칭. pt → px 1:1)
 *
 * Stretch 1: 위치는 X/Y/W/H 숫자 입력 (드래그/리사이즈 없음)
 * Stretch 2 (별도): 캔버스에서 직접 드래그/리사이즈
 *
 * 페이지 크기:
 *   A4 landscape  = 842 × 595 pt
 *   A4 portrait   = 595 × 842 pt
 *   letter ld     = 792 × 612 pt
 *   letter pt     = 612 × 792 pt
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronUp, ChevronDown, Trash2, Save, ArrowLeft, Type, Image as ImageIcon, Square } from 'lucide-react'
import Link from 'next/link'
import { ImagePicker } from './ImagePicker'
import { substitute, type CertData } from '@/lib/cert-render'
import type { CertElement, CertificateTemplate } from '@/types/database'

const PAGE_DIMS = {
  'A4-landscape':     { w: 842, h: 595 },
  'A4-portrait':      { w: 595, h: 842 },
  'letter-landscape': { w: 792, h: 612 },
  'letter-portrait':  { w: 612, h: 792 },
} as const

const SAMPLE_DATA: CertData = {
  recipient_name: '홍길동',
  course_title: 'AI 입문 과정',
  course_duration: '8시간 30분',
  enrolled_at: '2026년 03월 15일',
  completed_at: '2026년 05월 06일',
  cert_number: 'CERT-20260506-AB12',
  instructor_name: '김강사',
}

const PLACEHOLDERS = [
  ['{{recipient_name}}',   '수료자 이름'],
  ['{{course_title}}',     '강좌명'],
  ['{{course_duration}}',  '강좌 총 시간'],
  ['{{enrolled_at}}',      '수강 신청일'],
  ['{{completed_at}}',     '수료일'],
  ['{{cert_number}}',      '수료증 번호'],
  ['{{instructor_name}}',  '강사명'],
] as const

interface Props {
  mode: 'create' | 'edit'
  initial: CertificateTemplate | null
}

export function CertTemplateEditor({ mode, initial }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pageSize, setPageSize] = useState<'A4'|'letter'>(initial?.page_size ?? 'A4')
  const [orient, setOrient] = useState<'landscape'|'portrait'>(initial?.page_orientation ?? 'landscape')
  const [bgColor, setBgColor] = useState(initial?.background_color ?? '#FFFFFF')
  const [bgUrl, setBgUrl] = useState<string>(initial?.background_url ?? '')
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false)
  const [elements, setElements] = useState<CertElement[]>(initial?.elements ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
  const [imagePickerForId, setImagePickerForId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dims = PAGE_DIMS[`${pageSize}-${orient}`]
  const selected = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId]
  )

  // ─── element 조작 ─────────────────────────────────
  const addElement = (type: CertElement['type']) => {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
    let el: CertElement
    if (type === 'text') {
      el = {
        id, type: 'text',
        x: dims.w / 2 - 100, y: dims.h / 2 - 12, w: 200, h: 24,
        content: '텍스트', font_size: 14, color: '#0B1F3A', align: 'center',
      }
    } else if (type === 'image') {
      el = {
        id, type: 'image',
        x: dims.w / 2 - 50, y: dims.h / 2 - 50, w: 100, h: 100,
        url: '',
      }
    } else {
      el = {
        id, type: 'rect',
        x: 0, y: 0, w: dims.w, h: 80, fill: '#0B1F3A',
      }
    }
    setElements((arr) => [...arr, el])
    setSelectedId(id)
  }

  const updateSelected = (patch: Partial<CertElement>) => {
    if (!selectedId) return
    setElements((arr) => arr.map((e) =>
      e.id === selectedId ? ({ ...e, ...patch } as CertElement) : e
    ))
  }
  const updateById = (id: string, patch: Partial<CertElement>) => {
    setElements((arr) => arr.map((e) =>
      e.id === id ? ({ ...e, ...patch } as CertElement) : e
    ))
  }
  const removeSelected = () => {
    if (!selectedId) return
    setElements((arr) => arr.filter((e) => e.id !== selectedId))
    setSelectedId(null)
  }
  const moveSelected = (dir: -1 | 1) => {
    if (!selectedId) return
    const idx = elements.findIndex((e) => e.id === selectedId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= elements.length) return
    const next = [...elements]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setElements(next)
  }

  // ─── 저장 ─────────────────────────────────────────
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = {
        name, description: description || null,
        page_size: pageSize, page_orientation: orient,
        background_color: bgColor,
        background_url: bgUrl || null,
        elements,
        is_default: isDefault,
      }
      const res = await fetch('/api/admin/certificate-templates', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? body : { id: initial!.id, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장 실패')
      if (mode === 'create' && json.template?.id) {
        router.push(`/admin/certificates/templates/${json.template.id}`)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      setError(e?.message ?? '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async () => {
    if (!initial) return
    if (!confirm('이 템플릿을 삭제할까요?')) return
    const res = await fetch('/api/admin/certificate-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: initial.id }),
    })
    const json = await res.json()
    if (!res.ok) { alert(json.error ?? '삭제 실패'); return }
    router.push('/admin/certificates/templates')
  }

  // ─── 렌더 ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/certificates/templates" className="text-caption text-accent hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> 목록으로
          </Link>
          <h1 className="mt-1 text-h3 text-navy">{mode === 'create' ? '새 템플릿' : '템플릿 편집'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <button
              onClick={deleteTemplate}
              className="rounded-md border border-danger-border bg-surface px-3 py-2 text-body-sm text-danger hover:bg-danger-soft"
            >
              삭제
            </button>
          )}
          <button
            onClick={save} disabled={saving || !name}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
      {error && <div className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-caption text-danger">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* 좌측 패널 */}
        <div className="space-y-3">
          {/* 메타 */}
          <fieldset className="rounded-lg border border-border-subtle bg-surface p-3">
            <legend className="px-1 text-caption font-semibold text-navy">템플릿 메타</legend>
            <div className="space-y-2">
              <div>
                <label className="block text-micro text-gray-500">이름 *</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-micro text-gray-500">설명</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-micro text-gray-500">크기</label>
                  <select value={pageSize} onChange={(e) => setPageSize(e.target.value as 'A4' | 'letter')}
                    className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm">
                    <option value="A4">A4</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-micro text-gray-500">방향</label>
                  <select value={orient} onChange={(e) => setOrient(e.target.value as 'landscape'|'portrait')}
                    className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm">
                    <option value="landscape">가로</option>
                    <option value="portrait">세로</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-micro text-gray-500">배경 색</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                  className="mt-0.5 h-8 w-full rounded-md border border-border-subtle" />
              </div>
              <div>
                <label className="block text-micro text-gray-500">배경 이미지 (옵션)</label>
                <div className="mt-0.5 flex items-center gap-2">
                  <input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="https://..."
                    className="flex-1 rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm" />
                  <button type="button" onClick={() => setBgPickerOpen(true)}
                    className="rounded-md border border-accent bg-surface px-2 py-1.5 text-caption text-accent hover:bg-accent-pale">
                    선택
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-body-sm text-navy">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                기본 템플릿으로 설정 (새 수료증 발급 시 자동 적용)
              </label>
            </div>
          </fieldset>

          {/* element 추가 + 목록 */}
          <fieldset className="rounded-lg border border-border-subtle bg-surface p-3">
            <legend className="px-1 text-caption font-semibold text-navy">요소</legend>
            <div className="flex flex-wrap gap-1">
              <ToolBtn onClick={() => addElement('text')} icon={Type}>텍스트</ToolBtn>
              <ToolBtn onClick={() => addElement('image')} icon={ImageIcon}>이미지/직인</ToolBtn>
              <ToolBtn onClick={() => addElement('rect')} icon={Square}>박스</ToolBtn>
            </div>
            <ul className="mt-2 max-h-[200px] space-y-1 overflow-y-auto">
              {elements.map((el, idx) => (
                <li key={el.id}>
                  <button type="button" onClick={() => setSelectedId(el.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-caption transition ${
                      selectedId === el.id ? 'bg-accent-pale text-accent' : 'hover:bg-surface-muted'
                    }`}>
                    <span className="truncate">
                      <span className="text-gray-400">#{idx + 1}</span>{' '}
                      <span className="font-medium">{el.type}</span>
                      {el.type === 'text' && <span className="ml-1 text-gray-500">{shortText((el as Extract<CertElement, {type: 'text'}>).content)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          {/* 선택된 element 속성 */}
          {selected && (
            <fieldset className="rounded-lg border border-accent bg-accent-pale/30 p-3">
              <legend className="px-1 text-caption font-semibold text-accent">선택된 요소: {selected.type}</legend>
              <div className="mb-2 flex justify-end gap-1">
                <IconBtn title="위로" onClick={() => moveSelected(-1)}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="아래로" onClick={() => moveSelected(1)}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="삭제" onClick={removeSelected} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
              <ElementForm
                el={selected}
                onChange={updateSelected}
                openImagePicker={() => setImagePickerForId(selected.id)}
              />
              {selected.type === 'text' && (
                <div className="mt-3 rounded-md border border-border-subtle bg-surface p-2">
                  <p className="text-micro font-semibold text-gray-500">동적 placeholder (클릭해서 삽입)</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {PLACEHOLDERS.map(([key, label]) => (
                      <button key={key} type="button"
                        onClick={() => updateSelected({ content: ((selected as Extract<CertElement,{type:'text'}>).content ?? '') + key })}
                        className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-micro text-navy hover:bg-accent-pale"
                        title={`${key} → ${label}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>
          )}
        </div>

        {/* 우측 미리보기 */}
        <div className="rounded-lg border border-border-subtle bg-surface-muted p-4">
          <p className="mb-2 text-caption text-gray-500">미리보기 (실시간) — 좌표는 PDF pt 단위 (1pt ≒ 1px @ 100%)</p>
          <div className="overflow-auto">
            <Preview
              dims={dims}
              bgColor={bgColor}
              bgUrl={bgUrl}
              elements={elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateById}
              data={SAMPLE_DATA}
            />
          </div>
        </div>
      </div>

      {bgPickerOpen && (
        <ImagePicker current={bgUrl} onClose={() => setBgPickerOpen(false)}
          onConfirm={(url) => { setBgUrl(url); setBgPickerOpen(false) }} />
      )}
      {imagePickerForId && selected?.type === 'image' && (
        <ImagePicker
          current={(selected as Extract<CertElement, {type:'image'}>).url}
          onClose={() => setImagePickerForId(null)}
          onConfirm={(url) => { updateSelected({ url } as any); setImagePickerForId(null) }}
        />
      )}
    </div>
  )
}

// ─── Element 속성 폼 ──────────────────────────────────
function ElementForm({
  el, onChange, openImagePicker,
}: {
  el: CertElement
  onChange: (patch: Partial<CertElement>) => void
  openImagePicker: () => void
}) {
  return (
    <div className="space-y-2">
      {/* 위치/크기 */}
      <div className="grid grid-cols-4 gap-1">
        <NumField label="X" value={el.x} onChange={(v) => onChange({ x: v } as any)} />
        <NumField label="Y" value={el.y} onChange={(v) => onChange({ y: v } as any)} />
        <NumField label="W" value={el.w} onChange={(v) => onChange({ w: v } as any)} />
        <NumField label="H" value={el.h} onChange={(v) => onChange({ h: v } as any)} />
      </div>

      {el.type === 'text' && (
        <>
          <div>
            <label className="block text-micro text-gray-500">내용</label>
            <textarea value={el.content} onChange={(e) => onChange({ content: e.target.value } as any)} rows={2}
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-body-sm focus:border-accent focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-1">
            <NumField label="크기" value={el.font_size} onChange={(v) => onChange({ font_size: v } as any)} />
            <div>
              <label className="block text-micro text-gray-500">두께</label>
              <select value={el.font_weight ?? 'normal'} onChange={(e) => onChange({ font_weight: e.target.value as 'normal'|'bold' } as any)}
                className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-1.5 py-1 text-body-sm">
                <option value="normal">보통</option>
                <option value="bold">굵게</option>
              </select>
            </div>
            <div>
              <label className="block text-micro text-gray-500">정렬</label>
              <select value={el.align ?? 'left'} onChange={(e) => onChange({ align: e.target.value as 'left'|'center'|'right' } as any)}
                className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-1.5 py-1 text-body-sm">
                <option value="left">왼쪽</option>
                <option value="center">중앙</option>
                <option value="right">오른쪽</option>
              </select>
            </div>
          </div>
          <ColorField label="색상" value={el.color ?? '#0B1F3A'} onChange={(v) => onChange({ color: v } as any)} />
        </>
      )}

      {el.type === 'image' && (
        <>
          <div>
            <label className="block text-micro text-gray-500">이미지 URL</label>
            <div className="mt-0.5 flex items-center gap-1">
              <input value={el.url} onChange={(e) => onChange({ url: e.target.value } as any)}
                className="flex-1 rounded-md border border-border-subtle bg-surface px-2 py-1 text-body-sm" />
              <button type="button" onClick={openImagePicker}
                className="rounded-md border border-accent bg-surface px-2 py-1 text-caption text-accent hover:bg-accent-pale">
                선택
              </button>
            </div>
            <p className="mt-1 text-micro text-gray-400">투명 배경 PNG (직인) 권장. 미디어 라이브러리에서 업로드.</p>
          </div>
          <NumField label="투명도 (0~1)" value={el.opacity ?? 1} step={0.1} onChange={(v) => onChange({ opacity: v } as any)} />
        </>
      )}

      {el.type === 'rect' && (
        <>
          <ColorField label="배경" value={el.fill ?? '#FFFFFF'} onChange={(v) => onChange({ fill: v } as any)} />
          <NumField label="라운드 (px)" value={el.radius ?? 0} onChange={(v) => onChange({ radius: v } as any)} />
          <div>
            <label className="block text-micro text-gray-500">테두리 (예: 1px solid #ccc)</label>
            <input value={el.border ?? ''} onChange={(e) => onChange({ border: e.target.value } as any)}
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1 text-body-sm" />
          </div>
        </>
      )}
    </div>
  )
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-micro text-gray-500">{label}</label>
      <input type="number" value={value} step={step ?? 1} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-1.5 py-1 text-body-sm" />
    </div>
  )
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-micro text-gray-500">{label}</label>
      <div className="mt-0.5 flex items-center gap-1">
        <input type="color" value={value.startsWith('#') ? value : '#000000'} onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 rounded border border-border-subtle" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-border-subtle bg-surface px-1.5 py-1 text-body-sm" />
      </div>
    </div>
  )
}

function ToolBtn({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Type; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2 py-1 text-caption text-navy hover:border-accent hover:bg-accent-pale">
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}
function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`rounded p-1 text-gray-500 hover:bg-surface-muted ${danger ? 'hover:bg-danger-soft hover:text-danger' : ''}`}>
      {children}
    </button>
  )
}

function shortText(s: string): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 14 ? t.slice(0, 14) + '…' : t
}

// ─── Preview canvas (drag + resize) ──────────────────
//
// 동작:
//   - 요소 클릭 → 선택 (좌측 폼이 그 요소 표시)
//   - 요소 드래그 → 위치 (X, Y) 변경
//   - 선택된 요소 우하단 핸들 드래그 → 크기 (W, H) 변경
//   - 모든 변경은 0.25pt 단위 round (Snap), 페이지 경계 클램프
//   - 변경은 onUpdate 콜백으로 즉시 반영 (좌측 X/Y/W/H 폼도 동기 갱신)
//
// 스케일링:
//   화면상 px → pt 환산. (px / scale = pt). 드래그 deltaX/deltaY 도 동일 스케일링.
//   고밀도 디스플레이는 movementX/Y 가 device px 라 일관성 위해 clientX 기준 차이로.
//
// 키보드 — 향후: 화살표 키로 1pt 단위 미세 이동.

interface DragState {
  kind: 'move' | 'resize-br'
  id: string
  startMouseX: number
  startMouseY: number
  startEl: { x: number; y: number; w: number; h: number }
}

const SNAP_PT = 0.5    // pt 단위 — 너무 큰 snap 은 미세 조정 어렵게 함

function snap(v: number): number {
  return Math.round(v / SNAP_PT) * SNAP_PT
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function Preview({
  dims, bgColor, bgUrl, elements, selectedId, onSelect, onUpdate, data,
}: {
  dims: { w: number; h: number }
  bgColor: string
  bgUrl: string
  elements: CertElement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<CertElement>) => void
  data: CertData
}) {
  const [scale, setScale] = useState(1)
  const dragRef = useRef<DragState | null>(null)

  // pointer move/up 은 document 레벨 — 요소 밖으로 빠르게 움직여도 추적 안 끊김
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const dxPt = (e.clientX - drag.startMouseX) / scale
      const dyPt = (e.clientY - drag.startMouseY) / scale

      if (drag.kind === 'move') {
        const nx = clamp(snap(drag.startEl.x + dxPt), 0, dims.w - drag.startEl.w)
        const ny = clamp(snap(drag.startEl.y + dyPt), 0, dims.h - drag.startEl.h)
        onUpdate(drag.id, { x: nx, y: ny } as Partial<CertElement>)
      } else if (drag.kind === 'resize-br') {
        const nw = clamp(snap(drag.startEl.w + dxPt), 8, dims.w - drag.startEl.x)
        const nh = clamp(snap(drag.startEl.h + dyPt), 8, dims.h - drag.startEl.y)
        onUpdate(drag.id, { w: nw, h: nh } as Partial<CertElement>)
      }
    }
    function onUp() {
      dragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [scale, dims.w, dims.h, onUpdate])

  function startDrag(e: React.PointerEvent, kind: DragState['kind'], el: CertElement) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(el.id)
    dragRef.current = {
      kind, id: el.id,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startEl: { x: el.x, y: el.y, w: el.w, h: el.h },
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = kind === 'move' ? 'grabbing' : 'nwse-resize'
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-caption text-gray-500">{dims.w} × {dims.h} pt</span>
        <input type="range" min={0.4} max={1} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))}
          className="flex-1 max-w-[200px]" />
        <span className="text-caption text-gray-500">{Math.round(scale * 100)}%</span>
        <span className="text-micro text-gray-400">Tip: 요소를 드래그해 이동, 우하단 핸들로 크기 조정</span>
      </div>
      <div
        className="relative overflow-hidden rounded-md shadow-elev-2 select-none"
        style={{
          width: dims.w * scale,
          height: dims.h * scale,
          backgroundColor: bgColor,
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        onPointerDown={(e) => {
          // 빈 캔버스 클릭 → 선택 해제는 안 함 (원치 않는 deselect 방지)
          // 다만 stopPropagation 도 안 해서 자식 요소 클릭은 정상 동작
          void e
        }}
      >
        {elements.map((el) => {
          const isSel = selectedId === el.id
          const base: React.CSSProperties = {
            position: 'absolute',
            left: el.x * scale,
            top: el.y * scale,
            width: el.w * scale,
            height: el.h * scale,
            outline: isSel ? '2px solid #2D7DD2' : 'none',
            outlineOffset: 1,
            cursor: dragRef.current?.id === el.id ? 'grabbing' : 'grab',
            touchAction: 'none',                // 모바일 스크롤 충돌 방지
          }

          let inner: React.ReactNode = null
          if (el.type === 'rect') {
            base.backgroundColor = el.fill ?? 'transparent'
            base.borderRadius = (el.radius ?? 0) * scale
            base.border = el.border ?? undefined
          } else if (el.type === 'image') {
            base.opacity = el.opacity ?? 1
            inner = el.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={el.url} alt="" draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>이미지</div>
            )
          } else {
            base.fontSize = el.font_size * scale
            base.fontWeight = el.font_weight ?? 'normal'
            base.color = el.color ?? '#0B1F3A'
            base.textAlign = el.align ?? 'left'
            base.lineHeight = 1.2
            base.overflow = 'hidden'
            base.whiteSpace = 'pre-wrap'
            inner = substitute(el.content, data)
          }

          return (
            <div
              key={el.id}
              onPointerDown={(e) => startDrag(e, 'move', el)}
              style={base}
            >
              {inner}
              {/* 선택된 요소만 우하단 리사이즈 핸들 노출 */}
              {isSel && (
                <div
                  onPointerDown={(e) => startDrag(e, 'resize-br', el)}
                  style={{
                    position: 'absolute',
                    right: -6,
                    bottom: -6,
                    width: 12,
                    height: 12,
                    background: '#2D7DD2',
                    border: '2px solid white',
                    borderRadius: 2,
                    cursor: 'nwse-resize',
                    touchAction: 'none',
                  }}
                  title="크기 조정"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
