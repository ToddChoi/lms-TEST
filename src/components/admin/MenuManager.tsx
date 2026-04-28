'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ExternalLink, ArrowUp, ArrowDown, ArrowLeftRight } from 'lucide-react'

export interface Menu {
  id: number
  label: string
  href: string
  menu_type: 'header' | 'footer'
  sort_order: number
  target: string
  is_active: boolean
}

interface Props {
  initialMenus: Menu[]
}

interface FormState {
  label: string
  href: string
  menu_type: 'header' | 'footer'
  sort_order: number
  target: string
  is_active: boolean
}

const emptyForm: FormState = {
  label: '',
  href: '',
  menu_type: 'header',
  sort_order: 0,
  target: '_self',
  is_active: true,
}

function toFormState(m: Menu): FormState {
  return {
    label: m.label,
    href: m.href,
    menu_type: m.menu_type,
    sort_order: m.sort_order,
    target: m.target ?? '_self',
    is_active: m.is_active,
  }
}

export default function MenuManager({ initialMenus }: Props) {
  const router = useRouter()
  const [menus, setMenus] = useState<Menu[]>(initialMenus)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header')

  const filtered = [...menus]
    .filter((m) => m.menu_type === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order)

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, menu_type: activeTab })
    setError('')
    setModalOpen(true)
  }

  function openEdit(menu: Menu) {
    setEditingId(menu.id)
    setForm(toFormState(menu))
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  async function handleSave() {
    if (!form.label.trim()) { setError('메뉴 이름은 필수입니다.'); return }
    if (!form.href.trim()) { setError('링크 URL은 필수입니다.'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/menus', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? '저장 실패')
      return
    }

    const data = await res.json()
    if (editingId) {
      setMenus((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...form } : m))
      )
    } else {
      setMenus((prev) => [...prev, data.menu])
    }
    closeModal()
    router.refresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('이 메뉴를 삭제하시겠습니까?')) return
    setLoading(true)
    const res = await fetch('/api/admin/menus', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      setMenus((prev) => prev.filter((m) => m.id !== id))
      router.refresh()
    } else {
      const data = await res.json()
      alert(data.error ?? '삭제 실패')
    }
  }

  async function toggleActive(menu: Menu) {
    const res = await fetch('/api/admin/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: menu.id, is_active: !menu.is_active }),
    })
    if (res.ok) {
      setMenus((prev) =>
        prev.map((m) => (m.id === menu.id ? { ...m, is_active: !m.is_active } : m))
      )
    }
  }

  async function moveMenu(id: number, neighborId: number) {
    if (moving) return
    setMoving(true)

    const current = menus.find((m) => m.id === id)
    const neighbor = menus.find((m) => m.id === neighborId)
    if (!current || !neighbor) { setMoving(false); return }

    // 낙관적 업데이트
    setMenus((prev) =>
      prev.map((m) => {
        if (m.id === id) return { ...m, sort_order: neighbor.sort_order }
        if (m.id === neighborId) return { ...m, sort_order: current.sort_order }
        return m
      })
    )

    await Promise.all([
      fetch('/api/admin/menus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, sort_order: neighbor.sort_order }),
      }),
      fetch('/api/admin/menus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: neighborId, sort_order: current.sort_order }),
      }),
    ])

    setMoving(false)
    router.refresh()
  }

  async function toggleLocation(menu: Menu) {
    const newType = menu.menu_type === 'header' ? 'footer' : 'header'
    const res = await fetch('/api/admin/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: menu.id, menu_type: newType }),
    })
    if (res.ok) {
      setMenus((prev) =>
        prev.map((m) => (m.id === menu.id ? { ...m, menu_type: newType } : m))
      )
      router.refresh()
    }
  }

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]'

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {(['header', 'footer'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'header' ? '헤더 메뉴' : '푸터 메뉴'}
            <span className="ml-1.5 text-xs text-gray-400">
              ({menus.filter((m) => m.menu_type === tab).length})
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition"
        >
          <Plus className="h-4 w-4" /> 메뉴 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-16">순서</th>
              <th className="px-4 py-3 text-left font-semibold">메뉴 이름</th>
              <th className="px-4 py-3 text-left font-semibold">링크</th>
              <th className="px-4 py-3 text-left font-semibold w-20 hidden md:table-cell">타겟</th>
              <th className="px-4 py-3 text-center font-semibold w-16">활성</th>
              <th className="px-4 py-3 text-center font-semibold w-36">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  메뉴가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((m, idx) => (
              <tr key={m.id} className="hover:bg-[#E8F2FC]/20 transition">
                {/* ▲/▼ 순서 버튼 */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => idx > 0 && moveMenu(m.id, filtered[idx - 1].id)}
                      disabled={idx === 0 || moving}
                      className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
                      title="위로 이동"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => idx < filtered.length - 1 && moveMenu(m.id, filtered[idx + 1].id)}
                      disabled={idx === filtered.length - 1 || moving}
                      className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
                      title="아래로 이동"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[#0B1F3A]">{m.label}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                    {m.href}
                    {m.target === '_blank' && <ExternalLink className="h-3 w-3" />}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.target === '_blank' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {m.target}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(m)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${
                      m.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {m.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    {/* 위치 이동 버튼 */}
                    <button
                      onClick={() => toggleLocation(m)}
                      className="bg-amber-50 text-amber-600 p-1.5 rounded hover:bg-amber-500 hover:text-white transition"
                      title={m.menu_type === 'header' ? '푸터로 이동' : '헤더로 이동'}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(m)}
                      className="bg-[#E8F2FC] text-[#2D7DD2] p-1.5 rounded hover:bg-[#2D7DD2] hover:text-white transition"
                      title="수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={loading}
                      className="bg-red-50 text-red-500 p-1.5 rounded hover:bg-red-500 hover:text-white transition disabled:opacity-60"
                      title="삭제"
                    >
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
            <h2 className="text-lg font-bold text-[#0B1F3A]">
              {editingId ? '메뉴 수정' : '메뉴 추가'}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메뉴 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setField('label', e.target.value)}
                  placeholder="예: 강좌"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  링크 URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.href}
                  onChange={(e) => setField('href', e.target.value)}
                  placeholder="예: /courses"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
                  <select
                    value={form.menu_type}
                    onChange={(e) => setField('menu_type', e.target.value as 'header' | 'footer')}
                    className={inputCls}
                  >
                    <option value="header">헤더</option>
                    <option value="footer">푸터</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">타겟</label>
                  <select
                    value={form.target}
                    onChange={(e) => setField('target', e.target.value)}
                    className={inputCls}
                  >
                    <option value="_self">현재 탭</option>
                    <option value="_blank">새 탭</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">순서</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setField('sort_order', Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="menu-active"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                  className="w-4 h-4 accent-[#2D7DD2]"
                />
                <label htmlFor="menu-active" className="text-sm text-gray-700">활성화</label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={loading}
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
