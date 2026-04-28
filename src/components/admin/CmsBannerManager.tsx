'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, Link as LinkIcon, ArrowUp, ArrowDown } from 'lucide-react'

export interface CmsBanner {
  id: string
  section_id: string
  title: string
  image_url: string | null
  link_url: string | null
  link_target: string
  sort_order: number
  is_visible: boolean
  starts_at: string | null
  ends_at: string | null
}

interface FormState {
  title: string
  image_url: string
  link_url: string
  link_target: string
  sort_order: number
  is_visible: boolean
  starts_at: string
  ends_at: string
}

const emptyForm: FormState = {
  title: '', image_url: '', link_url: '', link_target: '_self',
  sort_order: 0, is_visible: true, starts_at: '', ends_at: '',
}

interface Props {
  sectionId: string
}

export default function CmsBannerManager({ sectionId }: Props) {
  const [banners, setBanners] = useState<CmsBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/admin/cms/banners?section_id=${sectionId}`)
      .then((r) => r.json())
      .then((d) => { setBanners(d.banners ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sectionId])

  const sorted = [...banners].sort((a, b) => a.sort_order - b.sort_order)

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, sort_order: (banners.length + 1) * 10 })
    setImageTab('url')
    setError(''); setUploadError('')
    setModalOpen(true)
  }

  function openEdit(b: CmsBanner) {
    setEditingId(b.id)
    setForm({
      title: b.title, image_url: b.image_url ?? '', link_url: b.link_url ?? '',
      link_target: b.link_target, sort_order: b.sort_order, is_visible: b.is_visible,
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : '',
      ends_at:   b.ends_at   ? b.ends_at.slice(0, 16)   : '',
    })
    setImageTab('url')
    setError(''); setUploadError('')
    setModalOpen(true)
  }

  async function handleFileUpload(file: File) {
    setUploading(true); setUploadError('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/cms/banners/upload', { method: 'POST', body: fd })
    setUploading(false)
    if (!res.ok) { const d = await res.json(); setUploadError(d.error ?? '업로드 실패'); return }
    const d = await res.json()
    setForm((s) => ({ ...s, image_url: d.url }))
  }

  async function handleSave() {
    setSaving(true); setError('')
    const payload = {
      ...form,
      image_url: form.image_url || null,
      link_url:  form.link_url  || null,
      starts_at: form.starts_at || null,
      ends_at:   form.ends_at   || null,
    }
    const method = editingId ? 'PUT' : 'POST'
    const url    = editingId
      ? `/api/admin/cms/banners/${editingId}`
      : '/api/admin/cms/banners'
    const body   = editingId ? payload : { section_id: sectionId, ...payload }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? '저장 실패'); return }
    const d = await res.json()

    if (editingId) {
      setBanners((prev) => prev.map((b) => b.id === editingId ? { ...b, ...payload } : b))
    } else {
      setBanners((prev) => [...prev, d.banner])
    }
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/cms/banners/${id}`, { method: 'DELETE' })
    if (res.ok) setBanners((prev) => prev.filter((b) => b.id !== id))
  }

  async function toggleVisible(b: CmsBanner) {
    const res = await fetch(`/api/admin/cms/banners/${b.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: !b.is_visible }),
    })
    if (res.ok) setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, is_visible: !x.is_visible } : x))
  }

  async function moveBanner(id: string, neighborId: string) {
    const a = banners.find((b) => b.id === id)
    const nb = banners.find((b) => b.id === neighborId)
    if (!a || !nb) return
    setBanners((prev) => prev.map((b) => {
      if (b.id === id) return { ...b, sort_order: nb.sort_order }
      if (b.id === neighborId) return { ...b, sort_order: a.sort_order }
      return b
    }))
    await Promise.all([
      fetch(`/api/admin/cms/banners/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: nb.sort_order }) }),
      fetch(`/api/admin/cms/banners/${neighborId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div className="mt-6 border-t border-gray-200 pt-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#0B1F3A]">배너 목록 ({banners.length})</h4>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-[#0B1F3A] text-white px-3 py-1.5 rounded-lg text-xs hover:bg-[#162d4f] transition"
        >
          <Plus className="h-3.5 w-3.5" /> 배너 추가
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">불러오는 중...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">
          등록된 배너가 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((b, idx) => (
            <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border ${b.is_visible ? 'border-gray-100 bg-white' : 'border-dashed border-gray-200 opacity-60 bg-gray-50'}`}>
              {/* 순서 */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => idx > 0 && moveBanner(b.id, sorted[idx - 1].id)} disabled={idx === 0} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button onClick={() => idx < sorted.length - 1 && moveBanner(b.id, sorted[idx + 1].id)} disabled={idx === sorted.length - 1} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              {/* 썸네일 */}
              {b.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={b.image_url} alt={b.title} className="h-12 w-20 object-cover rounded-lg shrink-0 border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="h-12 w-20 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-xs text-gray-400">없음</div>
              )}

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0B1F3A] truncate">{b.title || '(제목 없음)'}</p>
                {b.link_url && <p className="text-xs text-gray-400 truncate">{b.link_url}</p>}
              </div>

              {/* 작업 */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleVisible(b)} className={`p-1.5 rounded-lg transition ${b.is_visible ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={b.is_visible ? '숨기기' : '표시'}>
                  {b.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-[#2D7DD2] hover:bg-[#E8F2FC] transition" title="수정">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition" title="삭제">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 배너 추가/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#0B1F3A]">{editingId ? '배너 수정' : '배너 추가'}</h3>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            {/* 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이미지</label>
              <div className="flex gap-1 mb-2 bg-gray-100 p-1 rounded-lg w-fit">
                {(['url', 'upload'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setImageTab(t)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${imageTab === t ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'url' ? <><LinkIcon className="h-3 w-3" /> URL 입력</> : <><Upload className="h-3 w-3" /> 파일 업로드</>}
                  </button>
                ))}
              </div>
              {imageTab === 'url' ? (
                <input type="url" value={form.image_url} onChange={(e) => setForm((s) => ({ ...s, image_url: e.target.value }))} placeholder="https://..." className={inputCls} />
              ) : (
                <div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-5 text-sm text-gray-500 hover:border-[#2D7DD2] hover:text-[#2D7DD2] transition disabled:opacity-60">
                    <Upload className="h-4 w-4" />
                    {uploading ? '업로드 중...' : '클릭하여 파일 선택 (5MB 이하)'}
                  </button>
                  {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
                  {form.image_url && imageTab === 'upload' && <p className="mt-1 text-xs text-green-600">✓ 업로드 완료</p>}
                </div>
              )}
              {form.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <div className="mt-2 h-24 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img src={form.image_url} alt="미리보기" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input type="text" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="배너 제목 (관리용)" className={inputCls} />
            </div>

            {/* 링크 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL</label>
                <input type="url" value={form.link_url} onChange={(e) => setForm((s) => ({ ...s, link_url: e.target.value }))} placeholder="https://..." className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 타겟</label>
                <select value={form.link_target} onChange={(e) => setForm((s) => ({ ...s, link_target: e.target.value }))} className={inputCls}>
                  <option value="_self">현재 탭</option>
                  <option value="_blank">새 탭</option>
                </select>
              </div>
            </div>

            {/* 기간 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">노출 시작</label>
                <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((s) => ({ ...s, starts_at: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">노출 종료</label>
                <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((s) => ({ ...s, ends_at: e.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="b-visible" checked={form.is_visible} onChange={(e) => setForm((s) => ({ ...s, is_visible: e.target.checked }))} className="w-4 h-4 accent-[#2D7DD2]" />
              <label htmlFor="b-visible" className="text-sm text-gray-700">활성화</label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || uploading} className="flex-1 bg-[#2D7DD2] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setModalOpen(false)} className="px-4 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
