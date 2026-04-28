'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, ImageIcon, Upload, Link as LinkIcon } from 'lucide-react'

export interface Banner {
  id: number
  title: string | null
  image_url: string
  link_url: string | null
  link_target: string
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

interface Props {
  initialBanners: Banner[]
}

interface FormState {
  title: string
  image_url: string
  link_url: string
  link_target: string
  sort_order: number
  is_active: boolean
  starts_at: string
  ends_at: string
}

const emptyForm: FormState = {
  title: '',
  image_url: '',
  link_url: '',
  link_target: '_self',
  sort_order: 0,
  is_active: true,
  starts_at: '',
  ends_at: '',
}

function toFormState(b: Banner): FormState {
  return {
    title: b.title ?? '',
    image_url: b.image_url,
    link_url: b.link_url ?? '',
    link_target: b.link_target ?? '_self',
    sort_order: b.sort_order,
    is_active: b.is_active,
    starts_at: b.starts_at ? b.starts_at.slice(0, 16) : '',
    ends_at: b.ends_at ? b.ends_at.slice(0, 16) : '',
  }
}

export default function BannerManager({ initialBanners }: Props) {
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>(initialBanners)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 이미지 입력 탭
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setImageTab('url')
    setUploadError('')
    setModalOpen(true)
  }

  function openEdit(banner: Banner) {
    setEditingId(banner.id)
    setForm(toFormState(banner))
    setError('')
    setImageTab('url')
    setUploadError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setUploadError('')
  }

  function set(key: keyof FormState, value: string | number | boolean) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError('')

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/admin/banners/upload', {
      method: 'POST',
      body: fd,
    })

    setUploading(false)

    if (!res.ok) {
      const data = await res.json()
      setUploadError(data.error ?? '업로드 실패')
      return
    }

    const data = await res.json()
    setForm((s) => ({ ...s, image_url: data.url }))
    setUploadError('')
  }

  async function handleSave() {
    if (!form.image_url.trim()) { setError('이미지를 등록해주세요 (URL 입력 또는 파일 업로드).'); return }
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    }

    const res = await fetch('/api/admin/banners', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? '저장 실패')
      return
    }

    const data = await res.json()
    if (editingId) {
      setBanners((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                title: form.title || null,
                image_url: form.image_url,
                link_url: form.link_url || null,
                link_target: form.link_target,
                sort_order: form.sort_order,
                is_active: form.is_active,
                starts_at: form.starts_at || null,
                ends_at: form.ends_at || null,
              }
            : b
        )
      )
    } else {
      setBanners((prev) => [...prev, data.banner])
    }
    closeModal()
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return
    setLoading(true)
    const res = await fetch('/api/admin/banners', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      setBanners((prev) => prev.filter((b) => b.id !== id))
      router.refresh()
    } else {
      const data = await res.json()
      alert(data.error ?? '삭제 실패')
    }
  }

  async function toggleActive(banner: Banner) {
    const res = await fetch('/api/admin/banners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: banner.id, is_active: !banner.is_active }),
    })
    if (res.ok) {
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
      )
    }
  }

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{banners.length}개의 배너</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition"
        >
          <Plus className="h-4 w-4" /> 배너 추가
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <ImageIcon className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">배너가 없습니다. 배너를 추가해보세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-24">미리보기</th>
                <th className="px-4 py-3 text-left font-semibold">제목 / 링크</th>
                <th className="px-4 py-3 text-left font-semibold w-16 hidden md:table-cell">순서</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">기간</th>
                <th className="px-4 py-3 text-center font-semibold w-16">활성</th>
                <th className="px-4 py-3 text-center font-semibold w-28">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {banners.map((b) => (
                <tr key={b.id} className="hover:bg-[#E8F2FC]/20 transition">
                  <td className="px-4 py-3">
                    <div className="h-14 w-24 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.image_url}
                        alt={b.title ?? '배너'}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B1F3A]">{b.title ?? '(제목 없음)'}</p>
                    {b.link_url && (
                      <a
                        href={b.link_url}
                        target={b.link_target}
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#2D7DD2] hover:underline mt-0.5 truncate max-w-xs"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {b.link_url}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{b.sort_order}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                    {b.starts_at || b.ends_at ? (
                      <span>
                        {b.starts_at ? new Date(b.starts_at).toLocaleDateString('ko-KR') : '—'}
                        {' ~ '}
                        {b.ends_at ? new Date(b.ends_at).toLocaleDateString('ko-KR') : '상시'}
                      </span>
                    ) : (
                      <span className="text-gray-400">상시 노출</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(b)}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${
                        b.is_active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={b.is_active ? '비활성화' : '활성화'}
                    >
                      {b.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openEdit(b)}
                        className="bg-[#E8F2FC] text-[#2D7DD2] p-1.5 rounded text-xs hover:bg-[#2D7DD2] hover:text-white transition"
                        title="수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={loading}
                        className="bg-red-50 text-red-500 p-1.5 rounded text-xs hover:bg-red-500 hover:text-white transition disabled:opacity-60"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#0B1F3A]">
              {editingId ? '배너 수정' : '배너 추가'}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* 이미지 섹션 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이미지 <span className="text-red-500">*</span>
                </label>

                {/* 탭 전환 */}
                <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setImageTab('url')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                      imageTab === 'url'
                        ? 'bg-white text-[#0B1F3A] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    URL 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab('upload')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                      imageTab === 'upload'
                        ? 'bg-white text-[#0B1F3A] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    파일 업로드
                  </button>
                </div>

                {imageTab === 'url' ? (
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => set('image_url', e.target.value)}
                    placeholder="https://..."
                    className={inputCls}
                  />
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-6 text-sm text-gray-500 hover:border-[#2D7DD2] hover:text-[#2D7DD2] transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Upload className="h-5 w-5" />
                      {uploading ? '업로드 중...' : '클릭하여 파일 선택 (JPG, PNG, WebP, GIF · 최대 5MB)'}
                    </button>
                    {uploadError && (
                      <p className="mt-1 text-xs text-red-500">{uploadError}</p>
                    )}
                    {form.image_url && imageTab === 'upload' && (
                      <p className="mt-1 text-xs text-green-600 break-all">✓ 업로드 완료</p>
                    )}
                  </div>
                )}

                {/* 이미지 미리보기 */}
                {form.image_url && (
                  <div className="mt-2 h-32 w-full rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.image_url}
                      alt="미리보기"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 (선택)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="배너 제목"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL</label>
                <input
                  type="url"
                  value={form.link_url}
                  onChange={(e) => set('link_url', e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">링크 타겟</label>
                  <select
                    value={form.link_target}
                    onChange={(e) => set('link_target', e.target.value)}
                    className={inputCls}
                  >
                    <option value="_self">현재 탭 (_self)</option>
                    <option value="_blank">새 탭 (_blank)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => set('sort_order', Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 시작</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => set('starts_at', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 종료</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => set('ends_at', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="banner-active"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                  className="w-4 h-4 accent-[#2D7DD2]"
                />
                <label htmlFor="banner-active" className="text-sm text-gray-700">활성화</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={loading || uploading}
                className="flex-1 bg-[#2D7DD2] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
