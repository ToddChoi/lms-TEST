'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, EyeOff, Settings, Trash2, ArrowUp, ArrowDown, Plus, GripVertical,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddSectionModal, { SECTION_TYPES } from './AddSectionModal'
import SectionConfigDrawer, { type CmsHomeSection } from './SectionConfigDrawer'

interface Props {
  initialSections: CmsHomeSection[]
}

export default function CmsSectionManager({ initialSections }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<CmsHomeSection[]>(initialSections)
  const [drawerSection, setDrawerSection] = useState<CmsHomeSection | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [moving, setMoving] = useState(false)

  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleUpdate(id: string, updates: Partial<CmsHomeSection>) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s))
    if (drawerSection?.id === id) {
      setDrawerSection((prev) => prev ? { ...prev, ...updates } : prev)
    }
    router.refresh()
  }

  async function handleAdd(type: string, label: string) {
    const res = await fetch('/api/admin/cms/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, label }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? '섹션 추가 실패')
    }
    const d = await res.json()
    setSections((prev) => [...prev, d.section])
    router.refresh()
  }

  async function handleToggleVisible(section: CmsHomeSection) {
    const res = await fetch(`/api/admin/cms/sections/${section.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: !section.is_visible }),
    })
    if (res.ok) handleUpdate(section.id, { is_visible: !section.is_visible })
  }

  async function handleDelete(section: CmsHomeSection) {
    const hasBanners = section.type === 'banner'
    const msg = hasBanners
      ? `"${section.label}" 섹션을 삭제하면 소속된 배너도 모두 함께 삭제됩니다.\n정말 삭제하시겠습니까?`
      : `"${section.label}" 섹션을 삭제하시겠습니까?`
    if (!confirm(msg)) return

    const res = await fetch(`/api/admin/cms/sections/${section.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== section.id))
      if (drawerSection?.id === section.id) setDrawerSection(null)
      router.refresh()
    }
  }

  /** 인접한 두 섹션의 sort_order swap (▲▼ 버튼용) */
  async function moveSection(id: string, neighborId: string) {
    if (moving) return
    setMoving(true)
    const current  = sections.find((s) => s.id === id)
    const neighbor = sections.find((s) => s.id === neighborId)
    if (!current || !neighbor) { setMoving(false); return }

    setSections((prev) => prev.map((s) => {
      if (s.id === id)         return { ...s, sort_order: neighbor.sort_order }
      if (s.id === neighborId) return { ...s, sort_order: current.sort_order }
      return s
    }))

    await Promise.all([
      fetch(`/api/admin/cms/sections/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: neighbor.sort_order }),
      }),
      fetch(`/api/admin/cms/sections/${neighborId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: current.sort_order }),
      }),
    ])
    setMoving(false)
    router.refresh()
  }

  /** 드래그앤드롭 종료 — 새 순서를 0..N-1 로 재할당해 일괄 PUT */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || moving) return

    const oldIndex = sorted.findIndex((s) => s.id === active.id)
    const newIndex = sorted.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    setMoving(true)
    const reordered = arrayMove(sorted, oldIndex, newIndex)
    // 화면 즉시 반영
    setSections((prev) =>
      prev.map((s) => {
        const newOrder = reordered.findIndex((r) => r.id === s.id)
        return newOrder >= 0 ? { ...s, sort_order: newOrder } : s
      })
    )

    // 변경된 모든 섹션을 병렬 PUT
    await Promise.all(
      reordered.map((s, i) =>
        fetch(`/api/admin/cms/sections/${s.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: i }),
        })
      )
    )
    setMoving(false)
    router.refresh()
  }

  const typeInfo = (type: string) => SECTION_TYPES.find((t) => t.type === type)

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#162d4f] transition"
        >
          <Plus className="h-4 w-4" /> 섹션 추가
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-gray-500 font-medium">등록된 섹션이 없습니다</p>
          <p className="text-sm text-gray-400">위 [섹션 추가] 버튼을 눌러 첫 섹션을 추가해보세요.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sorted.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sorted.map((section, idx) => (
                <SortableSectionCard
                  key={section.id}
                  section={section}
                  idx={idx}
                  total={sorted.length}
                  moving={moving}
                  typeBadge={typeInfo(section.type)}
                  onMoveUp={() => idx > 0 && moveSection(section.id, sorted[idx - 1].id)}
                  onMoveDown={() => idx < sorted.length - 1 && moveSection(section.id, sorted[idx + 1].id)}
                  onToggle={() => handleToggleVisible(section)}
                  onConfig={() => setDrawerSection(section)}
                  onDelete={() => handleDelete(section)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAddModal && (
        <AddSectionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {drawerSection && (
        <SectionConfigDrawer
          section={drawerSection}
          onClose={() => setDrawerSection(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}

interface CardProps {
  section: CmsHomeSection
  idx: number
  total: number
  moving: boolean
  typeBadge: { type: string; emoji: string; name: string; desc: string } | undefined
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: () => void
  onConfig: () => void
  onDelete: () => void
}

function SortableSectionCard({
  section, idx, total, moving, typeBadge,
  onMoveUp, onMoveDown, onToggle, onConfig, onDelete,
}: CardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
        section.is_visible ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-70'
      } ${isDragging ? 'shadow-lg ring-2 ring-[#2D7DD2]' : ''}`}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* 드래그 핸들 */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="드래그하여 순서 변경"
            className="h-7 w-5 flex items-center justify-center text-gray-300 hover:text-[#0B1F3A] cursor-grab active:cursor-grabbing"
            title="드래그하여 순서 변경"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* ▲▼ 버튼 (드래그를 못하는 환경 fallback) */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={idx === 0 || moving}
              className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
              title="위로"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={idx === total - 1 || moving}
              className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#0B1F3A] hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
              title="아래로"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
            {typeBadge?.emoji} {section.type}
          </span>
          <span className="font-semibold text-[#0B1F3A] truncate">{section.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
            section.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {section.is_visible ? '표시' : '숨김'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${
              section.is_visible
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {section.is_visible ? <><EyeOff className="h-3.5 w-3.5" /> 숨기기</> : <><Eye className="h-3.5 w-3.5" /> 표시</>}
          </button>

          <button
            onClick={onConfig}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[#E8F2FC] text-[#2D7DD2] rounded-lg hover:bg-[#2D7DD2] hover:text-white transition"
          >
            <Settings className="h-3.5 w-3.5" /> 설정
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
