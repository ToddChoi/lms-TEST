'use client'

/**
 * 회사 컬렉션 + 학습맵 통합 관리자 — 회사 상세 페이지에 임베드.
 *
 * 두 리스트를 탭으로 분리:
 *   - 컬렉션 (course 묶음 — 페이지 빌더의 company_collection 블록이 참조)
 *   - 학습맵 (직무·직급별 학습 시퀀스)
 *
 * 둘 다 동일한 모달 에디터 — name / description / course_ids picker / target_*.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Library, Map as MapIcon } from 'lucide-react'
import { CoursePicker } from './CoursePicker'

type Tab = 'collections' | 'paths'

interface Collection {
  id: string
  name: string
  description: string | null
  course_ids: string[]
  is_active: boolean
}
interface Path {
  id: string
  name: string
  description: string | null
  target_role: string | null
  target_level: string | null
  course_ids: string[]
  is_active: boolean
}

interface Props { companyId: string }

export function CompanyCollectionsManager({ companyId }: Props) {
  const [tab, setTab] = useState<Tab>('collections')
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-surface-muted p-1 text-body-sm">
        <TabBtn active={tab === 'collections'} onClick={() => setTab('collections')} icon={Library}>강좌 컬렉션</TabBtn>
        <TabBtn active={tab === 'paths'}       onClick={() => setTab('paths')}       icon={MapIcon}>학습맵</TabBtn>
      </div>
      {tab === 'collections' ? <CollectionsList companyId={companyId} /> : <PathsList companyId={companyId} />}
    </div>
  )
}

function TabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: typeof Library; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
        active ? 'bg-surface text-navy shadow-elev-1' : 'text-gray-500 hover:text-navy'
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  )
}

// ─── Collections ─────────────────────────────────────
function CollectionsList({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/companies/${companyId}/collections`)
    const { collections } = await res.json()
    setItems(collections ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { reload() }, [reload])

  const onDelete = async (id: string) => {
    if (!confirm('이 컬렉션을 삭제할까요?')) return
    await fetch(`/api/admin/companies/${companyId}/collections`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    reload(); router.refresh()
  }
  const onToggle = async (c: Collection) => {
    await fetch(`/api/admin/companies/${companyId}/collections`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
    })
    reload(); router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <p className="text-caption text-gray-500">
          페이지 빌더의 <code className="rounded bg-surface-muted px-1">company_collection</code> 블록이 이 컬렉션을 참조합니다.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-body-sm font-semibold text-white hover:bg-accent-light"
        >
          <Plus className="h-4 w-4" /> 컬렉션 추가
        </button>
      </div>

      {loading ? (
        <p className="text-body-sm text-gray-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle p-8 text-center text-body-sm text-gray-500">
          컬렉션이 없습니다. 신입 온보딩, 리더십 필수 등 강좌 묶음을 만들어 보세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <CollectionRow
              key={c.id} c={c}
              onEdit={() => setEditing(c)}
              onDelete={() => onDelete(c.id)}
              onToggle={() => onToggle(c)}
            />
          ))}
        </ul>
      )}

      {showCreate && (
        <CollectionEditor
          mode="create" companyId={companyId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); reload(); router.refresh() }}
        />
      )}
      {editing && (
        <CollectionEditor
          mode="edit" companyId={companyId} initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); router.refresh() }}
        />
      )}
    </div>
  )
}

function CollectionRow({
  c, onEdit, onDelete, onToggle,
}: { c: Collection; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface p-3 shadow-elev-1">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-semibold text-navy">{c.name}</span>
          <span className={`rounded px-1.5 py-0.5 text-micro font-medium ${
            c.is_active ? 'bg-success-soft text-success' : 'bg-surface-muted text-gray-500'
          }`}>{c.is_active ? '활성' : '비활성'}</span>
          <span className="inline-flex items-center gap-1 text-caption text-gray-500">
            <BookOpen className="h-3 w-3" />{c.course_ids.length}개
          </span>
        </div>
        {c.description && <p className="mt-0.5 truncate text-caption text-gray-500">{c.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconBtn title="편집" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
        <IconBtn title={c.is_active ? '비활성화' : '활성화'} onClick={onToggle}>
          {c.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="삭제" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconBtn>
      </div>
    </li>
  )
}

interface CollectionEditorProps {
  mode: 'create' | 'edit'
  companyId: string
  initial?: Collection
  onClose: () => void
  onSaved: () => void
}

function CollectionEditor({ mode, companyId, initial, onClose, onSaved }: CollectionEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [courseIds, setCourseIds] = useState<string[]>(initial?.course_ids ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const body = mode === 'create'
        ? { name, description, course_ids: courseIds }
        : { id: initial!.id, name, description, course_ids: courseIds }
      const res = await fetch(`/api/admin/companies/${companyId}/collections`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장 실패')
      onSaved()
    } catch (e: any) {
      setError(e?.message ?? '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-lg bg-surface p-5 shadow-elev-3">
        <h3 className="text-h5 text-navy">{mode === 'create' ? '컬렉션 추가' : '컬렉션 편집'}</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-caption font-semibold text-navy">이름</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="신입 온보딩, 리더십 필수 등"
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">설명 (선택)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">강좌</label>
            <div className="mt-0.5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className={courseIds.length === 0 ? 'text-gray-400' : 'text-navy'}>
                  {courseIds.length === 0 ? '선택된 강좌 없음' : `${courseIds.length}개 강좌`}
                </span>
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}
                className="rounded-md border border-accent bg-surface px-3 py-2 text-caption text-accent hover:bg-accent-pale">
                강좌 선택
              </button>
            </div>
          </div>
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">취소</button>
          <button type="submit" disabled={saving} className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {pickerOpen && (
          <CoursePicker initialIds={courseIds} onClose={() => setPickerOpen(false)}
            onConfirm={(ids) => { setCourseIds(ids); setPickerOpen(false) }} />
        )}
      </form>
    </div>
  )
}

// ─── Paths ───────────────────────────────────────────
function PathsList({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Path[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Path | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/companies/${companyId}/learning-paths`)
    const { paths } = await res.json()
    setItems(paths ?? [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { reload() }, [reload])

  const onDelete = async (id: string) => {
    if (!confirm('이 학습맵을 삭제할까요?')) return
    await fetch(`/api/admin/companies/${companyId}/learning-paths`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    reload(); router.refresh()
  }
  const onToggle = async (p: Path) => {
    await fetch(`/api/admin/companies/${companyId}/learning-paths`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    })
    reload(); router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <p className="text-caption text-gray-500">
          직무·직급별 학습 시퀀스. course_ids 의 순서가 학습 순서.
        </p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-body-sm font-semibold text-white hover:bg-accent-light">
          <Plus className="h-4 w-4" /> 학습맵 추가
        </button>
      </div>

      {loading ? (
        <p className="text-body-sm text-gray-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-subtle p-8 text-center text-body-sm text-gray-500">
          학습맵이 없습니다. 직무·직급별 강좌 시퀀스를 만들어 보세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <PathRow key={p.id} p={p}
              onEdit={() => setEditing(p)} onDelete={() => onDelete(p.id)} onToggle={() => onToggle(p)} />
          ))}
        </ul>
      )}

      {showCreate && (
        <PathEditor mode="create" companyId={companyId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); reload(); router.refresh() }} />
      )}
      {editing && (
        <PathEditor mode="edit" companyId={companyId} initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); router.refresh() }} />
      )}
    </div>
  )
}

function PathRow({
  p, onEdit, onDelete, onToggle,
}: { p: Path; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface p-3 shadow-elev-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-semibold text-navy">{p.name}</span>
          {(p.target_role || p.target_level) && (
            <span className="rounded bg-accent-pale px-1.5 py-0.5 text-micro font-medium text-accent">
              {p.target_role}{p.target_role && p.target_level ? ' · ' : ''}{p.target_level}
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-micro font-medium ${
            p.is_active ? 'bg-success-soft text-success' : 'bg-surface-muted text-gray-500'
          }`}>{p.is_active ? '활성' : '비활성'}</span>
          <span className="inline-flex items-center gap-1 text-caption text-gray-500">
            <BookOpen className="h-3 w-3" />{p.course_ids.length}개
          </span>
        </div>
        {p.description && <p className="mt-0.5 truncate text-caption text-gray-500">{p.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconBtn title="편집" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
        <IconBtn title={p.is_active ? '비활성화' : '활성화'} onClick={onToggle}>
          {p.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconBtn>
        <IconBtn title="삭제" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconBtn>
      </div>
    </li>
  )
}

interface PathEditorProps {
  mode: 'create' | 'edit'
  companyId: string
  initial?: Path
  onClose: () => void
  onSaved: () => void
}

function PathEditor({ mode, companyId, initial, onClose, onSaved }: PathEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [targetRole, setTargetRole] = useState(initial?.target_role ?? '')
  const [targetLevel, setTargetLevel] = useState(initial?.target_level ?? '')
  const [courseIds, setCourseIds] = useState<string[]>(initial?.course_ids ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const body = mode === 'create'
        ? { name, description, target_role: targetRole, target_level: targetLevel, course_ids: courseIds }
        : { id: initial!.id, name, description, target_role: targetRole, target_level: targetLevel, course_ids: courseIds }
      const res = await fetch(`/api/admin/companies/${companyId}/learning-paths`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장 실패')
      onSaved()
    } catch (e: any) {
      setError(e?.message ?? '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-lg bg-surface p-5 shadow-elev-3">
        <h3 className="text-h5 text-navy">{mode === 'create' ? '학습맵 추가' : '학습맵 편집'}</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-caption font-semibold text-navy">이름</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="신입 디자이너 1년차, 팀장 리더십 등"
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">설명 (선택)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-caption font-semibold text-navy">대상 직무</label>
              <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
                placeholder="designer, engineer, sales..."
                className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-navy">대상 직급</label>
              <input value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)}
                placeholder="staff, manager, director..."
                className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">강좌 (순서 = 학습 순서)</label>
            <div className="mt-0.5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className={courseIds.length === 0 ? 'text-gray-400' : 'text-navy'}>
                  {courseIds.length === 0 ? '선택된 강좌 없음' : `${courseIds.length}개 강좌`}
                </span>
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}
                className="rounded-md border border-accent bg-surface px-3 py-2 text-caption text-accent hover:bg-accent-pale">
                강좌 선택
              </button>
            </div>
          </div>
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">취소</button>
          <button type="submit" disabled={saving} className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
        {pickerOpen && (
          <CoursePicker initialIds={courseIds} onClose={() => setPickerOpen(false)}
            onConfirm={(ids) => { setCourseIds(ids); setPickerOpen(false) }} />
        )}
      </form>
    </div>
  )
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`rounded-md p-1.5 text-gray-500 transition hover:bg-surface-muted ${danger ? 'hover:bg-danger-soft hover:text-danger' : ''}`}>
      {children}
    </button>
  )
}
