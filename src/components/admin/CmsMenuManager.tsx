'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ExternalLink, ArrowUp, ArrowDown, ArrowLeftRight, Eye, EyeOff } from 'lucide-react'

export interface CmsNavMenu {
  id: string
  location: 'header' | 'footer'
  label: string
  url: string
  target: string
  sort_order: number
  is_visible: boolean
}

interface Props {
  initialMenus: CmsNavMenu[]
}

interface FormState {
  location: 'header' | 'footer'
  label: string
  url: string
  target: string
  sort_order: number
  is_visible: boolean
}

const emptyForm: FormState = {
  location: 'header', label: '', url: '', target: '_self', sort_order: 0, is_visible: true,
}

export default function CmsMenuManager({ initialMenus }: Props) {
  const router = useRouter()
  const [menus, setMenus] = useState<CmsNavMenu[]>(initialMenus)
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')

  const filtered = [...menus]
    .filter((m) => m.location === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order)

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, location: activeTab, sort_order: filtered.length + 1 })
    setError('')
    setModalOpen(true)
  }

  function openEdit(m: CmsNavMenu) {
    setEditingId(m.id)
    setForm({ location: m.location, label: m.label, url: m.url, target: m.target, sort_order: m.sort_order, is_visible: m.is_visible })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.label.trim()) { setError('메뉴 이름은 필수입니다.'); return }
    if (!form.url.trim())   { setError('URL은 필수입니다.'); return }
    setLoading(true); setError('')

    const method = editingId ? 'PUT' : 'POST'
    const url    = editingId ? `/api/admin/cms/menus/${editingId}` : '/api/admin/cms/menus'

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? '저장 실패'); return }
    const d = await res.json()

    if (editingId) {
      setMenus((prev) => prev.map((m) => m.id === editingId ? { ...m, ...form } : m))
    } else {
      setMenus((prev) => [...prev, d.menu])
    }
    setModalOpen(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 메뉴를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/cms/menus/${id}`, { method: 'DELETE' })
    if (res.ok) { setMenus((prev) => prev.filter((m) => m.id !== id)); router.refresh() }
  }

  async function toggleVisible(m: CmsNavMenu) {
    const res = await fetch(`/api/admin/cms/menus/${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: !m.is_visible }),
    })
    if (res.ok) setMenus((prev) => prev.map((x) => x.id === m.id ? { ...x, is_visible: !x.is_visible } : x))
  }

  async function toggleLocation(m: CmsNavMenu) {
    const newLoc: 'header' | 'footer' = m.location === 'header' ? 'footer' : 'header'
    const res = await fetch(`/api/admin/cms/menus/${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: newLoc }),
    })
    if (res.ok) { setMenus((prev) => prev.map((x) => x.id === m.id ? { ...x, location: newLoc } : x)); router.refresh() }
  }

  async function moveMenu(id: string, neighborId: string) {
    if (moving) return
    setMoving(true)
    const a = menus.find((m) => m.id === id)
    const b = menus.find((m) => m.id === neighborId)
    if (!a || !b) { setMoving(false); return }

    setMenus((prev) => prev.map((m) => {
      if (m.id === id)         return { ...m, sort_order: b.sort_order }
      if (m.id === neighborId) return { ...m, sort_order: a.sort_order }
      return m
    }))
    await Promise.all([
      fetch(`/api/admin/cms/menus/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/admin/cms/menus/${neighborId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
    setMoving(false)
    router.refresh()
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {(['header', 'footer'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'header' ? '헤더 메뉴' : '푸터 메뉴'}
            <span className="ml-1.5 text-xs text-gray-400">({menus.filter((m) => m.location === tab).length})</span>
          </button>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition">
          <Plus className="h-4 w-4" /> 메뉴 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-16">순서</th>
              <th className="px-4 py-3 text-left font-semibold">메뉴 이름</th>
              <th className="px-4 py-3 text-left font-semibold">URL</th>
              <th className="px-4 py-3 text-center font-semibold w-16">노출</th>
              <th className="px-4 py-3 text-center font-semibold w-36">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">메뉴가 없습니다.</td></tr>
            ) : filtered.map((m, idx) => (
              <tr key={m.id} className={`hover:bg-[#E8F2FC]/20 transition ${!m.is_visible ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => idx > 0 && moveMenu(m.id, filtered[idx - 1].id)} disabled={idx === 0 || moving}
                      className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => idx < filtered.length - 1 && moveMenu(m.id, filtered[idx + 1].id)} disabled={idx === filtered.length - 1 || moving}
                      className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[#0B1F3A]">{m.label}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                    {m.url}
                    {m.target === '_blank' && <ExternalLink className="h-3 w-3" />}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleVisible(m)}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition ${m.is_visible ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title={m.is_visible ? '숨기기' : '표시'}>
                    {m.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => toggleLocation(m)}
                      className="bg-amber-50 text-amber-600 p-1.5 rounded hover:bg-amber-500 hover:text-white transition"
                      title={m.location === 'header' ? '푸터로 이동' : '헤더로 이동'}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openEdit(m)}
                      className="bg-[#E8F2FC] text-[#2D7DD2] p-1.5 rounded hover:bg-[#2D7DD2] hover:text-white transition" title="수정">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} disabled={loading}
                      className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-500 hover:text-white transition disabled:opacity-60" title="삭제">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#0B1F3A]">{editingId ? '메뉴 수정' : '메뉴 추가'}</h2>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메뉴 이름 <span className="text-red-500">*</span></label>
                <input type="text" value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} placeholder="예: 강좌" className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL <span className="text-red-500">*</span></label>
                <input type="text" value={form.url} onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))} placeholder="예: /courses" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
                  <select value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value as 'header' | 'footer' }))} className={inputCls}>
                    <option value="header">헤더</option>
                    <option value="footer">푸터</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">타겟</label>
                  <select value={form.target} onChange={(e) => setForm((s) => ({ ...s, target: e.target.value }))} className={inputCls}>
                    <option value="_self">현재 탭</option>
                    <option value="_blank">새 탭</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">순서</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm((s) => ({ ...s, sort_order: Number(e.target.value) }))} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="m-visible" checked={form.is_visible} onChange={(e) => setForm((s) => ({ ...s, is_visible: e.target.checked }))} className="w-4 h-4 accent-[#2D7DD2]" />
                <label htmlFor="m-visible" className="text-sm text-gray-700">활성화</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={loading}
                className="flex-1 bg-[#2D7DD2] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60">
                {loading ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
