'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
  is_visible: boolean
}

interface Props {
  initialCategories: Category[]
}

interface EditState {
  name: string
  slug: string
  description: string
  icon: string
  sort_order: number
  is_visible: boolean
}

const emptyEdit: EditState = { name: '', slug: '', description: '', icon: '', sort_order: 0, is_visible: true }

export default function CategoryManager({ initialCategories }: Props) {
  const router = useRouter()
  // 항상 sort_order 기준으로 정렬된 상태로 보관
  const sortInit = [...initialCategories].sort((a, b) => a.sort_order - b.sort_order)
  const [categories, setCategories] = useState<Category[]>(sortInit)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>(emptyEdit)
  const [adding, setAdding] = useState(false)
  const [newState, setNewState] = useState<EditState>(emptyEdit)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditState({ name: cat.name, slug: cat.slug, description: cat.description ?? '', icon: cat.icon ?? '', sort_order: cat.sort_order, is_visible: cat.is_visible })
  }

  function cancelEdit() { setEditingId(null); setEditState(emptyEdit) }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
  }

  function resort(list: Category[]) {
    return [...list].sort((a, b) => a.sort_order - b.sort_order)
  }

  async function handleSaveEdit(id: string) {
    setLoading(true); setError('')
    const res = await fetch('/api/admin/categories', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editState }),
    })
    setLoading(false)
    if (res.ok) {
      setCategories((prev) => resort(prev.map((c) => c.id === id ? { ...c, name: editState.name, slug: editState.slug, description: editState.description || null, icon: editState.icon || null, sort_order: editState.sort_order, is_visible: editState.is_visible } : c)))
      setEditingId(null)
      router.refresh()
    } else {
      const d = await res.json(); setError(d.error ?? '저장 실패')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return
    setLoading(true); setError('')
    const res = await fetch('/api/admin/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setLoading(false)
    if (res.ok) { setCategories((prev) => prev.filter((c) => c.id !== id)); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? '삭제 실패') }
  }

  async function handleAdd() {
    if (!newState.name.trim()) { setError('카테고리 이름을 입력하세요.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newState) })
    setLoading(false)
    if (res.ok) {
      const d = await res.json()
      setCategories((prev) => resort([...prev, d.category]))
      setAdding(false); setNewState(emptyEdit)
      router.refresh()
    } else {
      const d = await res.json(); setError(d.error ?? '추가 실패')
    }
  }

  // 두 카테고리의 sort_order를 서로 바꿔서 저장 (▲▼ 클릭)
  async function swapOrder(a: Category, b: Category) {
    setLoading(true); setError('')
    // 화면 먼저 바꿔서 즉시 반영(optimistic update)
    setCategories((prev) => resort(prev.map((c) => {
      if (c.id === a.id) return { ...c, sort_order: b.sort_order }
      if (c.id === b.id) return { ...c, sort_order: a.sort_order }
      return c
    })))
    try {
      await Promise.all([
        fetch('/api/admin/categories', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, name: a.name, slug: a.slug, description: a.description ?? '', icon: a.icon ?? '', sort_order: b.sort_order, is_visible: a.is_visible }),
        }),
        fetch('/api/admin/categories', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: b.id, name: b.name, slug: b.slug, description: b.description ?? '', icon: b.icon ?? '', sort_order: a.sort_order, is_visible: b.is_visible }),
        }),
      ])
      router.refresh()
    } catch {
      setError('순서 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function moveUp(idx: number) {
    if (idx <= 0) return
    swapOrder(categories[idx], categories[idx - 1])
  }

  function moveDown(idx: number) {
    if (idx >= categories.length - 1) return
    swapOrder(categories[idx], categories[idx + 1])
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]'

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-3 py-3 text-center font-semibold w-16">순서</th>
              <th className="px-4 py-3 text-left font-semibold">이름</th>
              <th className="px-4 py-3 text-left font-semibold">슬러그</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">설명</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">아이콘</th>
              <th className="px-4 py-3 text-center font-semibold w-14">노출</th>
              <th className="px-4 py-3 text-center font-semibold w-28">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 && !adding && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">카테고리가 없습니다.</td></tr>
            )}

            {categories.map((cat, idx) =>
              editingId === cat.id ? (
                <tr key={cat.id} className="bg-[#E8F2FC]/40">
                  <td className="px-3 py-2">
                    <input type="number" value={editState.sort_order} onChange={(e) => setEditState((s) => ({ ...s, sort_order: Number(e.target.value) }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={editState.name} onChange={(e) => { const name = e.target.value; setEditState((s) => ({ ...s, name, slug: autoSlug(name) })) }} className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={editState.slug} onChange={(e) => setEditState((s) => ({ ...s, slug: e.target.value }))} className={inputCls} />
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <input value={editState.description} onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))} placeholder="간단한 설명" className={inputCls} />
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <input value={editState.icon} onChange={(e) => setEditState((s) => ({ ...s, icon: e.target.value }))} placeholder="이모지 or URL" className={inputCls} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={editState.is_visible} onChange={(e) => setEditState((s) => ({ ...s, is_visible: e.target.checked }))} className="w-4 h-4 accent-[#2D7DD2]" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleSaveEdit(cat.id)} disabled={loading} className="bg-[#2D7DD2] text-white px-3 py-1 rounded text-xs hover:bg-[#2566b0] disabled:opacity-60 transition">저장</button>
                      <button onClick={cancelEdit} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50 transition">취소</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={cat.id} className="hover:bg-[#E8F2FC]/20 transition">
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={loading || idx === 0}
                        title="위로"
                        className="text-gray-400 hover:text-[#2D7DD2] disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-gray-500">{cat.sort_order}</span>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={loading || idx === categories.length - 1}
                        title="아래로"
                        className="text-gray-400 hover:text-[#2D7DD2] disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {cat.icon && <span className="text-base">{cat.icon}</span>}
                      <span className="font-medium text-[#0B1F3A]">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell max-w-[200px] truncate">{cat.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{cat.icon ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {cat.is_visible ? <span className="text-green-500 font-bold">✓</span> : <span className="text-red-400 font-bold">✗</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => startEdit(cat)} className="bg-[#E8F2FC] text-[#2D7DD2] px-3 py-1 rounded text-xs hover:bg-[#2D7DD2] hover:text-white transition">수정</button>
                      <button onClick={() => handleDelete(cat.id)} disabled={loading} className="bg-red-50 text-red-500 px-3 py-1 rounded text-xs hover:bg-red-500 hover:text-white transition disabled:opacity-60">삭제</button>
                    </div>
                  </td>
                </tr>
              )
            )}

            {adding && (
              <tr className="bg-green-50/40">
                <td className="px-3 py-2">
                  <input type="number" value={newState.sort_order} onChange={(e) => setNewState((s) => ({ ...s, sort_order: Number(e.target.value) }))} className="border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]" />
                </td>
                <td className="px-3 py-2">
                  <input value={newState.name} onChange={(e) => { const name = e.target.value; setNewState((s) => ({ ...s, name, slug: autoSlug(name) })) }} placeholder="카테고리 이름" className={inputCls} autoFocus />
                </td>
                <td className="px-3 py-2">
                  <input value={newState.slug} onChange={(e) => setNewState((s) => ({ ...s, slug: e.target.value }))} placeholder="slug" className={inputCls} />
                </td>
                <td className="px-3 py-2 hidden lg:table-cell">
                  <input value={newState.description} onChange={(e) => setNewState((s) => ({ ...s, description: e.target.value }))} placeholder="설명 (선택)" className={inputCls} />
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <input value={newState.icon} onChange={(e) => setNewState((s) => ({ ...s, icon: e.target.value }))} placeholder="이모지 or URL" className={inputCls} />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={newState.is_visible} onChange={(e) => setNewState((s) => ({ ...s, is_visible: e.target.checked }))} className="w-4 h-4 accent-[#2D7DD2]" />
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={handleAdd} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-60 transition">추가</button>
                    <button onClick={() => { setAdding(false); setNewState(emptyEdit) }} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-xs hover:bg-gray-50 transition">취소</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <button onClick={() => setAdding(true)} className="mt-4 bg-[#0B1F3A] text-white px-5 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition">
          + 카테고리 추가
        </button>
      )}
    </div>
  )
}
