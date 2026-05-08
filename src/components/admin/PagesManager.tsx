'use client'

/**
 * Admin Pages Manager — 약관/개인정보 등 정적 페이지 CRUD.
 * body 는 일단 textarea (plain or markdown). WYSIWYG 은 다음 라운드.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Eye, EyeOff, ExternalLink, Pencil } from 'lucide-react'
import { RichEditor } from '@/components/ui/RichEditor'

interface PageRow {
  id: string
  slug: string
  title: string
  body: string | null
  status: 'draft' | 'published'
  updated_at: string
  published_at: string | null
}

export function PagesManager() {
  const router = useRouter()
  const [pages, setPages] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PageRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/pages')
    const { pages } = await res.json()
    setPages(pages ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleDelete = async (id: string) => {
    if (!confirm('이 페이지를 삭제할까요?')) return
    await fetch('/api/admin/pages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    reload(); router.refresh()
  }

  const handleToggleStatus = async (p: PageRow) => {
    const next = p.status === 'published' ? 'draft' : 'published'
    await fetch('/api/admin/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: next }),
    })
    reload(); router.refresh()
  }

  if (loading) return <div className="text-body-sm text-gray-500">불러오는 중...</div>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light"
        >
          <Plus className="h-4 w-4" /> 페이지 추가
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center text-body-sm text-gray-500">
          페이지가 없습니다. 약관·개인정보처리방침부터 만들어 보세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-4 shadow-elev-1"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body font-semibold text-navy">{p.title}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-micro font-medium ${
                      p.status === 'published'
                        ? 'bg-success-soft text-success'
                        : 'bg-warning-soft text-warning'
                    }`}
                  >
                    {p.status === 'published' ? '게시' : '초안'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-caption text-gray-500">
                  /p/{p.slug}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {p.status === 'published' && (
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="공개 페이지 열기"
                    className="rounded-md p-1.5 text-gray-500 hover:bg-surface-muted"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => setEditing(p)}
                  title="편집"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-surface-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggleStatus(p)}
                  title={p.status === 'published' ? '숨김' : '게시'}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-surface-muted"
                >
                  {p.status === 'published' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  title="삭제"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <PageEditor
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); reload(); router.refresh() }}
        />
      )}
      {editing && (
        <PageEditor
          mode="edit"
          page={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); router.refresh() }}
        />
      )}
    </div>
  )
}

interface EditorProps {
  mode: 'create' | 'edit'
  page?: PageRow
  onClose: () => void
  onSaved: () => void
}

function PageEditor({ mode, page, onClose, onSaved }: EditorProps) {
  const [slug, setSlug] = useState(page?.slug ?? '')
  const [title, setTitle] = useState(page?.title ?? '')
  const [body, setBody] = useState(page?.body ?? '')
  const [status, setStatus] = useState<'draft' | 'published'>(page?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/pages', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create'
          ? { slug, title, body, status }
          : { id: page!.id, slug, title, body, status }
        ),
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
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-elev-3"
      >
        <h2 className="text-h5 text-navy">
          {mode === 'create' ? '새 페이지' : '페이지 편집'}
        </h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-caption font-semibold text-navy">slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              required
              placeholder="terms / privacy / refund"
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-micro text-gray-500">공개 URL: /p/{slug || '...'}</p>
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">본문</label>
            <div className="mt-0.5">
              <RichEditor
                value={body}
                onChange={setBody}
                placeholder="페이지 내용을 입력하세요..."
              />
            </div>
            <p className="mt-1 text-micro text-gray-500">
              헤딩 / 굵게 / 기울임 / 링크 / 이미지 / 리스트 / 인용 / 코드 지원.
              저장된 HTML 은 공개 페이지에서 sanitize 후 렌더됩니다.
            </p>
          </div>
          <div>
            <label className="block text-caption font-semibold text-navy">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              className="mt-0.5 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
            >
              <option value="draft">초안 (비공개)</option>
              <option value="published">게시 (공개)</option>
            </select>
          </div>
          {error && <p className="text-caption text-danger">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
