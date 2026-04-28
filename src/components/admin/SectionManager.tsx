'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDuration } from '@/lib/utils'
import { ChevronDown, ChevronRight, PlayCircle, Eye, Pencil, Trash2, Plus, GripVertical } from 'lucide-react'
import { VideoUploader } from '@/components/admin/VideoUploader'

export interface Lesson {
  id: string
  title: string
  video_url: string | null
  duration: number
  is_preview: boolean
  sort_order: number
}

export interface Section {
  id: string
  title: string
  sort_order: number
  lessons: Lesson[]
}

interface Props {
  courseId: string
  initialSections: Section[]
}

interface SectionForm { title: string; sort_order: number }
interface LessonForm { title: string; video_url: string; duration: number; is_preview: boolean; sort_order: number }

const emptySection: SectionForm = { title: '', sort_order: 0 }
const emptyLesson: LessonForm = { title: '', video_url: '', duration: 0, is_preview: false, sort_order: 0 }

// ── YouTube 유틸 ─────────────────────────────────────────────────
function getYoutubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function YoutubeThumbnail({ url }: { url: string }) {
  const vid = getYoutubeId(url)
  if (!vid) return null
  return (
    <div className="relative w-24 h-14 rounded overflow-hidden flex-shrink-0 bg-black group cursor-pointer"
      onClick={() => window.open(`https://www.youtube.com/watch?v=${vid}`, '_blank')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
        <PlayCircle className="w-6 h-6 text-white" />
      </div>
    </div>
  )
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}분 ${s}초` : `${m}분`
}

function LessonFormRow({
  courseId,
  form,
  onChange,
  onSave,
  onCancel,
  loading,
  isNew,
}: {
  courseId: string
  form: LessonForm
  onChange: (f: LessonForm) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  isNew?: boolean
}) {
  const [autoDetectedSec, setAutoDetectedSec] = useState<number | null>(null)
  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2D7DD2] w-full"

  function handleDurationDetected(seconds: number) {
    setAutoDetectedSec(seconds)
    // form.duration은 분 단위 (DB 저장 시 ×60)
    onChange({ ...form, duration: Math.ceil(seconds / 60) })
  }

  return (
    <div className={`p-4 rounded-xl border ${isNew ? 'border-green-200 bg-green-50/30' : 'border-[#2D7DD2]/20 bg-[#E8F2FC]/20'} space-y-4`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">강의 제목 *</label>
          <input
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="강의 제목을 입력하세요"
            className={inputCls}
            autoFocus={isNew}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">순서</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => onChange({ ...form, sort_order: Number(e.target.value) })}
            className={inputCls}
            placeholder="0"
          />
        </div>
      </div>

      {/* 영상 업로더 */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">강의 영상</label>
        <VideoUploader
          courseId={courseId}
          value={form.video_url}
          onChange={(url) => onChange({ ...form, video_url: url })}
          onDurationDetected={handleDurationDetected}
        />
      </div>

      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs text-gray-500">강의 시간 (분)</label>
            {autoDetectedSec !== null && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                ✓ 자동 감지 ({formatSeconds(autoDetectedSec)})
              </span>
            )}
          </div>
          <input
            type="number"
            value={form.duration}
            onChange={(e) => { setAutoDetectedSec(null); onChange({ ...form, duration: Number(e.target.value) }) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2D7DD2] w-24"
            placeholder="0"
            min={0}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={form.is_preview}
            onChange={(e) => onChange({ ...form, is_preview: e.target.checked })}
            className="w-4 h-4 accent-[#2D7DD2] rounded"
          />
          <span className="text-sm text-gray-700">무료 미리보기 허용</span>
        </label>
      </div>

      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={loading}
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2566b0] disabled:opacity-60 transition"
        >
          {loading ? '저장 중...' : isNew ? '강의 추가' : '변경 저장'}
        </button>
        <button
          onClick={onCancel}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          취소
        </button>
      </div>
    </div>
  )
}

export default function SectionManager({ courseId, initialSections }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(initialSections.map((s) => s.id)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [addingSection, setAddingSection] = useState(false)
  const [newSection, setNewSection] = useState<SectionForm>(emptySection)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editSectionForm, setEditSectionForm] = useState<SectionForm>(emptySection)

  const [addingLessonSectionId, setAddingLessonSectionId] = useState<string | null>(null)
  const [newLesson, setNewLesson] = useState<LessonForm>(emptyLesson)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [editLessonForm, setEditLessonForm] = useState<LessonForm>(emptyLesson)

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Section CRUD ──────────────────────────────────────────────

  async function handleAddSection() {
    if (!newSection.title.trim()) { setError('섹션 제목을 입력하세요.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, title: newSection.title, sort_order: newSection.sort_order }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setSections((prev) => [...prev, { ...data.section, lessons: [] }])
      setExpandedIds((prev) => new Set([...prev, data.section.id]))
      setAddingSection(false)
      setNewSection(emptySection)
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '추가 실패')
    }
  }

  async function handleSaveSection(id: string) {
    if (!editSectionForm.title.trim()) { setError('제목을 입력하세요.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editSectionForm.title, sort_order: editSectionForm.sort_order }),
    })
    setLoading(false)
    if (res.ok) {
      setSections((prev) => prev.map((s) => s.id === id ? { ...s, ...editSectionForm } : s))
      setEditingSectionId(null)
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '저장 실패')
    }
  }

  async function handleDeleteSection(id: string) {
    if (!confirm('섹션과 하위 모든 강의를 삭제하시겠습니까?')) return
    setLoading(true); setError('')
    const res = await fetch('/api/admin/sections', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== id))
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '삭제 실패')
    }
  }

  // ── Lesson CRUD ───────────────────────────────────────────────

  async function handleAddLesson(sectionId: string) {
    if (!newLesson.title.trim()) { setError('강의 제목을 입력하세요.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_id: sectionId,
        title: newLesson.title,
        video_url: newLesson.video_url || null,
        duration: newLesson.duration * 60,
        is_preview: newLesson.is_preview,
        sort_order: newLesson.sort_order,
      }),
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, lessons: [...s.lessons, data.lesson] } : s))
      setAddingLessonSectionId(null)
      setNewLesson(emptyLesson)
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '추가 실패')
    }
  }

  async function handleSaveLesson(lessonId: string, sectionId: string) {
    if (!editLessonForm.title.trim()) { setError('강의 제목을 입력하세요.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/lessons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: lessonId,
        title: editLessonForm.title,
        video_url: editLessonForm.video_url || null,
        duration: editLessonForm.duration * 60,
        is_preview: editLessonForm.is_preview,
        sort_order: editLessonForm.sort_order,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, lessons: s.lessons.map((l) => l.id === lessonId ? { ...l, ...editLessonForm, duration: editLessonForm.duration * 60 } : l) }
            : s
        )
      )
      setEditingLessonId(null)
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '저장 실패')
    }
  }

  async function handleDeleteLesson(lessonId: string, sectionId: string) {
    if (!confirm('이 강의를 삭제하시겠습니까?')) return
    setLoading(true); setError('')
    const res = await fetch('/api/admin/lessons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lessonId }),
    })
    setLoading(false)
    if (res.ok) {
      setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s))
      router.refresh()
    } else {
      const data = await res.json(); setError(data.error ?? '삭제 실패')
    }
  }

  // ── 총 강의 수 / 총 시간 계산 ──────────────────────────────────
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0)
  const totalDuration = sections.reduce((acc, s) => acc + s.lessons.reduce((a, l) => a + l.duration, 0), 0)

  return (
    <div>
      {/* 요약 */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
        <span>섹션 <strong className="text-[#0B1F3A]">{sections.length}</strong>개</span>
        <span>·</span>
        <span>강의 <strong className="text-[#0B1F3A]">{totalLessons}</strong>개</span>
        <span>·</span>
        <span>총 <strong className="text-[#0B1F3A]">{formatDuration(totalDuration)}</strong></span>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 border border-red-200 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 섹션 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#F4F6FA]">
              <button onClick={() => toggleExpand(section.id)} className="text-gray-400 hover:text-[#2D7DD2] transition">
                {expandedIds.has(section.id)
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>

              {editingSectionId === section.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editSectionForm.title}
                    onChange={(e) => setEditSectionForm((f) => ({ ...f, title: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]"
                    autoFocus
                  />
                  <input
                    type="number"
                    value={editSectionForm.sort_order}
                    onChange={(e) => setEditSectionForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]"
                    placeholder="순서"
                  />
                  <button onClick={() => handleSaveSection(section.id)} disabled={loading}
                    className="bg-[#2D7DD2] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#2566b0] disabled:opacity-60 transition">
                    저장
                  </button>
                  <button onClick={() => setEditingSectionId(null)}
                    className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition">
                    취소
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-[#0B1F3A] flex-1 text-sm">
                    섹션 {section.sort_order}. {section.title}
                  </span>
                  <span className="text-xs text-gray-400 mr-2">강의 {section.lessons.length}개</span>
                  <button
                    onClick={() => { setEditingSectionId(section.id); setEditSectionForm({ title: section.title, sort_order: section.sort_order }) }}
                    className="text-gray-400 hover:text-[#2D7DD2] p-1 rounded transition"
                    title="섹션 수정"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    disabled={loading}
                    className="text-gray-400 hover:text-red-500 p-1 rounded transition disabled:opacity-60"
                    title="섹션 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* 강의 목록 */}
            {expandedIds.has(section.id) && (
              <div className="p-4 space-y-2">
                {section.lessons.length === 0 && addingLessonSectionId !== section.id && (
                  <p className="text-center text-xs text-gray-400 py-4">아직 강의가 없습니다. 아래 버튼으로 추가하세요.</p>
                )}

                {section.lessons.map((lesson) =>
                  editingLessonId === lesson.id ? (
                    <LessonFormRow
                      key={lesson.id}
                      courseId={courseId}
                      form={editLessonForm}
                      onChange={setEditLessonForm}
                      onSave={() => handleSaveLesson(lesson.id, section.id)}
                      onCancel={() => setEditingLessonId(null)}
                      loading={loading}
                    />
                  ) : (
                    <div key={lesson.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-[#E8F2FC]/30 transition group"
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <span className="text-xs text-gray-400 w-5 text-center flex-shrink-0">{lesson.sort_order}</span>

                      {/* 썸네일 */}
                      {lesson.video_url && getYoutubeId(lesson.video_url) ? (
                        <div className="w-14 h-9 rounded overflow-hidden flex-shrink-0 bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://img.youtube.com/vi/${getYoutubeId(lesson.video_url)}/mqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : lesson.video_url ? (
                        <div className="w-14 h-9 rounded bg-[#E8F2FC] flex items-center justify-center flex-shrink-0">
                          <PlayCircle className="w-4 h-4 text-[#2D7DD2]" />
                        </div>
                      ) : (
                        <div className="w-14 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <PlayCircle className="w-4 h-4 text-gray-300" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0B1F3A] truncate">{lesson.title}</p>
                        <p className="text-xs text-gray-400">{formatDuration(lesson.duration)}</p>
                      </div>

                      {lesson.is_preview && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                          <Eye className="w-3 h-3" /> 미리보기
                        </span>
                      )}

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingLessonId(lesson.id)
                            setEditLessonForm({
                              title: lesson.title,
                              video_url: lesson.video_url ?? '',
                              duration: Math.round(lesson.duration / 60),
                              is_preview: lesson.is_preview,
                              sort_order: lesson.sort_order,
                            })
                          }}
                          className="text-gray-400 hover:text-[#2D7DD2] p-1.5 rounded transition"
                          title="강의 수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id, section.id)}
                          disabled={loading}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded transition disabled:opacity-60"
                          title="강의 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* 강의 추가 폼 */}
                {addingLessonSectionId === section.id && (
                  <LessonFormRow
                    courseId={courseId}
                    form={newLesson}
                    onChange={setNewLesson}
                    onSave={() => handleAddLesson(section.id)}
                    onCancel={() => { setAddingLessonSectionId(null); setNewLesson(emptyLesson) }}
                    loading={loading}
                    isNew
                  />
                )}

                {addingLessonSectionId !== section.id && (
                  <button
                    onClick={() => {
                      setAddingLessonSectionId(section.id)
                      setNewLesson({ ...emptyLesson, sort_order: section.lessons.length + 1 })
                    }}
                    className="flex items-center gap-1.5 text-[#2D7DD2] hover:text-[#2566b0] text-sm font-medium mt-1 transition"
                  >
                    <Plus className="w-4 h-4" /> 강의 추가
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* 섹션 추가 폼 */}
        {addingSection && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#2D7DD2]/30 p-4">
            <p className="text-sm font-semibold text-[#0B1F3A] mb-3">새 섹션 추가</p>
            <div className="flex items-center gap-3">
              <input
                value={newSection.title}
                onChange={(e) => setNewSection((f) => ({ ...f, title: e.target.value }))}
                placeholder="섹션 제목 (예: 1강 오리엔테이션)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
              />
              <input
                type="number"
                value={newSection.sort_order}
                onChange={(e) => setNewSection((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
                placeholder="순서"
              />
              <button onClick={handleAddSection} disabled={loading}
                className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2566b0] disabled:opacity-60 transition">
                추가
              </button>
              <button onClick={() => { setAddingSection(false); setNewSection(emptySection) }}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {!addingSection && (
        <button
          onClick={() => {
            setAddingSection(true)
            setNewSection({ title: '', sort_order: sections.length + 1 })
          }}
          className="mt-4 flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#162d4f] transition"
        >
          <Plus className="w-4 h-4" /> 섹션 추가
        </button>
      )}
    </div>
  )
}
