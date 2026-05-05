'use client'

/**
 * 페이지 빌더 — content_blocks 의 surface 별 편집기.
 *
 * 기능:
 *   - 블록 목록 + 순서 변경 (위/아래 버튼 — DnD 는 P3 에서 dnd-kit 도입)
 *   - 신규 블록 추가 (block_types 에서 선택)
 *   - 각 블록의 config 를 메타 driven 폼으로 편집
 *   - draft / published 토글
 *   - 삭제
 *
 * 메타 driven 폼:
 *   block_types.fields = [{name, type, label, required, options}, ...]
 *   각 필드의 type 에 따라 input/textarea/select/json/picker 렌더.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronUp, ChevronDown, Trash2, Eye, EyeOff, Settings } from 'lucide-react'

interface BlockType {
  id: string
  label: string
  description: string | null
  fields: FieldSchema[]
}

interface FieldSchema {
  name: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'image' | 'json' | 'course_picker' | 'company_picker'
  label: string
  required?: boolean
  options?: string[]
}

interface Block {
  id: string
  surface: string
  block_type: string
  config: Record<string, unknown>
  audience?: Record<string, unknown>
  sort_order: number
  status: 'draft' | 'published'
}

interface Props {
  surface: string
  surfaceLabel?: string
}

export function PageBuilder({ surface, surfaceLabel }: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [types, setTypes] = useState<BlockType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const [bRes, tRes] = await Promise.all([
      fetch(`/api/admin/content-blocks?surface=${encodeURIComponent(surface)}`),
      fetch('/api/admin/block-types'),
    ])
    const { blocks } = await bRes.json()
    const { types } = await tRes.json()
    setBlocks(blocks ?? [])
    setTypes(types ?? [])
    setLoading(false)
  }, [surface])

  useEffect(() => { reload() }, [reload])

  const handleAdd = async (block_type: string) => {
    const res = await fetch('/api/admin/content-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface, block_type, config: {} }),
    })
    if (res.ok) {
      setShowAdd(false)
      reload()
      router.refresh()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 블록을 삭제할까요?')) return
    const res = await fetch('/api/admin/content-blocks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { reload(); router.refresh() }
  }

  const handleToggleStatus = async (b: Block) => {
    const next = b.status === 'published' ? 'draft' : 'published'
    await fetch('/api/admin/content-blocks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, status: next }),
    })
    reload(); router.refresh()
  }

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setBlocks(next)
    await fetch('/api/admin/content-blocks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    })
    router.refresh()
  }

  const handleSaveBlock = async (
    id: string,
    config: Record<string, unknown>,
    audience: Record<string, unknown>,
  ) => {
    await fetch('/api/admin/content-blocks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, config, audience }),
    })
    setEditingId(null)
    reload(); router.refresh()
  }

  if (loading) return <div className="p-6 text-body-sm text-gray-500">불러오는 중...</div>

  const typeMap = new Map(types.map((t) => [t.id, t]))

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-h4 text-navy">페이지 빌더 — {surfaceLabel ?? surface}</h2>
          <p className="mt-1 text-body-sm text-gray-500">
            블록 단위로 페이지를 구성합니다. draft 상태는 사이트에 노출되지 않습니다.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" /> 블록 추가
        </button>
      </div>

      {blocks.length === 0 && (
        <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center text-body-sm text-gray-500">
          아직 블록이 없습니다. &ldquo;블록 추가&rdquo; 로 시작하세요.
        </div>
      )}

      <ul className="space-y-3">
        {blocks.map((b, idx) => {
          const type = typeMap.get(b.block_type)
          const isEditing = editingId === b.id
          return (
            <li
              key={b.id}
              className="rounded-lg border border-border-subtle bg-surface shadow-elev-1"
            >
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="flex flex-1 items-center gap-3 min-w-0">
                  <span className="text-caption font-mono text-gray-400">#{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-semibold text-navy">{type?.label ?? b.block_type}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-micro font-medium ${
                          b.status === 'published'
                            ? 'bg-success-soft text-success'
                            : 'bg-warning-soft text-warning'
                        }`}
                      >
                        {b.status === 'published' ? '게시' : '초안'}
                      </span>
                    </div>
                    <p className="truncate text-caption text-gray-500">
                      {summary(b.config)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconBtn title="위로"   onClick={() => handleMove(idx, -1)} disabled={idx === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="아래로" onClick={() => handleMove(idx, 1)} disabled={idx === blocks.length - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="설정"   onClick={() => setEditingId(isEditing ? null : b.id)}>
                    <Settings className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title={b.status === 'published' ? '숨김' : '게시'} onClick={() => handleToggleStatus(b)}>
                    {b.status === 'published' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn title="삭제" onClick={() => handleDelete(b.id)} danger>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>

              {isEditing && type && (
                <DynamicConfigForm
                  block={b}
                  type={type}
                  onCancel={() => setEditingId(null)}
                  onSave={(cfg, aud) => handleSaveBlock(b.id, cfg, aud)}
                />
              )}
            </li>
          )
        })}
      </ul>

      {showAdd && (
        <AddBlockModal types={types} onClose={() => setShowAdd(false)} onPick={handleAdd} />
      )}
    </div>
  )
}

function IconBtn({
  children, title, onClick, disabled, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 text-gray-500 transition hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? 'hover:bg-danger-soft hover:text-danger' : ''
      }`}
    >
      {children}
    </button>
  )
}

function summary(config: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof config.heading === 'string') parts.push(config.heading)
  if (typeof config.subheading === 'string') parts.push(config.subheading)
  if (Array.isArray(config.course_ids)) parts.push(`강좌 ${config.course_ids.length}개`)
  if (Array.isArray(config.items)) parts.push(`항목 ${config.items.length}개`)
  if (Array.isArray(config.logos)) parts.push(`로고 ${config.logos.length}개`)
  if (parts.length === 0) parts.push('(설정 비어 있음)')
  return parts.join(' · ')
}

// ─── 동적 폼 ──────────────────────────────────────
function DynamicConfigForm({
  block, type, onCancel, onSave,
}: {
  block: Block
  type: BlockType
  onCancel: () => void
  onSave: (cfg: Record<string, unknown>, audience: Record<string, unknown>) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>(block.config ?? {})
  const [audience, setAudience] = useState<AudienceState>(() => fromAudienceJson(block.audience))

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(values, toAudienceJson(audience)) }}
      className="space-y-3 border-t border-border-subtle bg-surface-subtle p-4"
    >
      {type.fields.map((f) => (
        <div key={f.name}>
          <label className="block text-caption font-semibold text-navy">{f.label}{f.required && <span className="text-danger"> *</span>}</label>
          <FieldInput
            field={f}
            value={values[f.name]}
            onChange={(v) => setValues((p) => ({ ...p, [f.name]: v }))}
          />
        </div>
      ))}

      {/* audience 편집 — 누구에게 보일지 (P4) */}
      <AudienceEditor value={audience} onChange={setAudience} />

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-body-sm text-gray-500 hover:bg-surface-muted">
          취소
        </button>
        <button type="submit" className="rounded-md bg-accent px-4 py-1.5 text-body-sm font-semibold text-white hover:bg-accent/90">
          저장
        </button>
      </div>
    </form>
  )
}

// ─── audience 편집 — 단순 select 모음 ─────────────
type LoggedInOpt = 'any' | 'logged' | 'guest'
type CompanyMemberOpt = 'any' | 'member' | 'non_member' | 'manager'

interface AudienceState {
  loggedIn: LoggedInOpt
  companyMember: CompanyMemberOpt
  rolesCsv: string                   // 'admin,instructor' 형태 — UI 단순화
  jobLevelsCsv: string
}

function fromAudienceJson(a: Record<string, unknown> | null | undefined): AudienceState {
  const obj = (a ?? {}) as {
    logged_in?: boolean
    is_company_member?: boolean
    is_company_manager?: boolean
    roles?: string[]
    job_levels?: string[]
  }
  let loggedIn: LoggedInOpt = 'any'
  if (obj.logged_in === true) loggedIn = 'logged'
  if (obj.logged_in === false) loggedIn = 'guest'

  let companyMember: CompanyMemberOpt = 'any'
  if (obj.is_company_manager) companyMember = 'manager'
  else if (obj.is_company_member === true) companyMember = 'member'
  else if (obj.is_company_member === false) companyMember = 'non_member'

  return {
    loggedIn,
    companyMember,
    rolesCsv: (obj.roles ?? []).join(','),
    jobLevelsCsv: (obj.job_levels ?? []).join(','),
  }
}

function toAudienceJson(s: AudienceState): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (s.loggedIn === 'logged') out.logged_in = true
  if (s.loggedIn === 'guest')  out.logged_in = false
  if (s.companyMember === 'member')     out.is_company_member = true
  if (s.companyMember === 'non_member') out.is_company_member = false
  if (s.companyMember === 'manager')    out.is_company_manager = true
  const roles = s.rolesCsv.split(',').map((x) => x.trim()).filter(Boolean)
  if (roles.length) out.roles = roles
  const levels = s.jobLevelsCsv.split(',').map((x) => x.trim()).filter(Boolean)
  if (levels.length) out.job_levels = levels
  return out
}

function AudienceEditor({
  value, onChange,
}: {
  value: AudienceState
  onChange: (s: AudienceState) => void
}) {
  const set = <K extends keyof AudienceState>(k: K, v: AudienceState[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="rounded-md border border-border-subtle bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="text-caption font-semibold text-navy">노출 조건 (audience)</span>
        <span className="text-micro text-gray-500">— 모두 비워두면 전체 공개</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-micro text-gray-500">로그인 여부</label>
          <select
            value={value.loggedIn}
            onChange={(e) => set('loggedIn', e.target.value as LoggedInOpt)}
            className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
          >
            <option value="any">상관없음</option>
            <option value="logged">로그인 회원만</option>
            <option value="guest">비로그인만</option>
          </select>
        </div>
        <div>
          <label className="block text-micro text-gray-500">회사 멤버십</label>
          <select
            value={value.companyMember}
            onChange={(e) => set('companyMember', e.target.value as CompanyMemberOpt)}
            className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
          >
            <option value="any">상관없음</option>
            <option value="member">회사 멤버 (어디든)</option>
            <option value="non_member">비회사 사용자</option>
            <option value="manager">회사 매니저</option>
          </select>
        </div>
        <div>
          <label className="block text-micro text-gray-500">role (콤마 구분)</label>
          <input
            type="text"
            value={value.rolesCsv}
            onChange={(e) => set('rolesCsv', e.target.value)}
            placeholder="예: admin,instructor"
            className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-micro text-gray-500">직급 (콤마 구분)</label>
          <input
            type="text"
            value={value.jobLevelsCsv}
            onChange={(e) => set('jobLevelsCsv', e.target.value)}
            placeholder="예: staff,manager,director"
            className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

function FieldInput({
  field, value, onChange,
}: {
  field: FieldSchema
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (field.type === 'textarea' || field.type === 'json') {
    const isJson = field.type === 'json'
    const display = isJson
      ? (value === undefined ? '' : JSON.stringify(value, null, 2))
      : String(value ?? '')
    return (
      <textarea
        value={display}
        onChange={(e) => {
          const v = e.target.value
          if (isJson) {
            try { onChange(JSON.parse(v || 'null')) } catch { /* invalid json — keep typing */ onChange(v) }
          } else {
            onChange(v)
          }
        }}
        rows={isJson ? 6 : 3}
        className="mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
        placeholder={isJson ? '[]  또는  {}  형태의 JSON' : ''}
      />
    )
  }
  if (field.type === 'select') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
      >
        <option value="">선택</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
      />
    )
  }
  if (field.type === 'image' || field.type === 'course_picker' || field.type === 'company_picker') {
    // P5 (미디어 라이브러리) / P4 (회사 picker) 에서 본격 — 지금은 텍스트 입력 fallback
    return (
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
        placeholder={
          field.type === 'image'           ? 'https://... (P5: 미디어 라이브러리 picker)' :
          field.type === 'course_picker'   ? '강좌 ID 들 콤마 구분 (P4: 강좌 picker)' :
                                             '회사 ID (P4: 회사 picker)'
        }
      />
    )
  }
  // text (default)
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
    />
  )
}

function AddBlockModal({
  types, onClose, onPick,
}: {
  types: BlockType[]
  onClose: () => void
  onPick: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-elev-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-h5 text-navy">블록 종류 선택</h3>
        <p className="mt-1 text-body-sm text-gray-500">추가할 블록을 골라 주세요. 추가 후 설정에서 세부 내용 입력.</p>
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {types.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onPick(t.id)}
                className="flex w-full flex-col items-start rounded-md border border-border-subtle bg-surface p-4 text-left transition hover:border-accent hover:bg-accent-pale"
              >
                <span className="text-body-sm font-semibold text-navy">{t.label}</span>
                {t.description && (
                  <span className="mt-1 text-caption text-gray-500">{t.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
