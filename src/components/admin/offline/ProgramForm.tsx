'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  OFFLINE_PROGRAM_TYPE_LABEL,
  OFFLINE_PROGRAM_STATUS_LABEL,
  type OfflineProgram,
  type OfflineProgramType,
  type OfflineProgramStatus,
} from '@/types/database'
import { Save, Trash2, Plus, X } from 'lucide-react'
import {
  createProgramAction,
  updateProgramAction,
  deleteProgramAction,
} from '@/app/admin/offline/programs/actions'

interface CategoryOption {
  id: string
  name: string
}

interface Props {
  /** 편집 모드면 기존 row, 신규면 undefined */
  initial?: OfflineProgram
  categories: CategoryOption[]
}

interface FormState {
  title: string
  slug: string
  description: string
  category_id: string  // '' = 미지정
  thumbnail_url: string
  program_type: OfflineProgramType
  instructor_name: string
  instructor_bio: string
  what_you_learn: string[]
  requirements: string[]
  target_audience: string
  completion_attendance_rate: number
  status: OfflineProgramStatus
  is_featured: boolean
}

function fromInitial(p: OfflineProgram | undefined): FormState {
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    description: p?.description ?? '',
    category_id: p?.category_id ?? '',
    thumbnail_url: p?.thumbnail_url ?? '',
    program_type: p?.program_type ?? 'workshop',
    instructor_name: p?.instructor_name ?? '',
    instructor_bio: p?.instructor_bio ?? '',
    what_you_learn: p?.what_you_learn ?? [],
    requirements: p?.requirements ?? [],
    target_audience: p?.target_audience ?? '',
    completion_attendance_rate: p?.completion_attendance_rate ?? 80,
    status: p?.status ?? 'draft',
    is_featured: p?.is_featured ?? false,
  }
}

/** 한글 / 영문 / 숫자 / 하이픈만, 공백은 하이픈으로 */
function autoSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function ProgramForm({ initial, categories }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(fromInitial(initial))
  const [submitting, startSubmit] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!initial

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addArrayItem(key: 'what_you_learn' | 'requirements') {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], ''] }))
  }
  function updateArrayItem(key: 'what_you_learn' | 'requirements', i: number, value: string) {
    setForm((prev) => {
      const next = [...prev[key]]
      next[i] = value
      return { ...prev, [key]: next }
    })
  }
  function removeArrayItem(key: 'what_you_learn' | 'requirements', i: number) {
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // 클라이언트 사전 검증 — 서버에서도 한 번 더
    if (form.title.trim().length < 2) {
      setError('프로그램명은 2자 이상이어야 합니다.')
      return
    }
    if (!/^[a-z0-9가-힣-]+$/.test(form.slug) || form.slug.length < 2) {
      setError('슬러그는 영문 소문자 / 숫자 / 한글 / 하이픈만 가능 (2자 이상).')
      return
    }
    if (form.completion_attendance_rate < 0 || form.completion_attendance_rate > 100) {
      setError('수료 출석률은 0~100 사이여야 합니다.')
      return
    }

    startSubmit(async () => {
      const input = {
        ...form,
        category_id: form.category_id || null,
        thumbnail_url: form.thumbnail_url || null,
        instructor_name: form.instructor_name || null,
        instructor_bio: form.instructor_bio || null,
        target_audience: form.target_audience || null,
        what_you_learn: form.what_you_learn.filter((s) => s.trim()),
        requirements: form.requirements.filter((s) => s.trim()),
      }
      const result = isEdit
        ? await updateProgramAction(initial!.id, input)
        : await createProgramAction(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/offline/programs')
    })
  }

  function handleDelete() {
    if (!isEdit) return
    if (!confirm(`"${initial!.title}" 프로그램을 삭제하시겠습니까?\n\n(소프트 삭제 — 회차/신청 데이터는 유지됨)`)) {
      return
    }
    setError(null)
    startDelete(async () => {
      const result = await deleteProgramAction(initial!.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/offline/programs')
    })
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-gray-50'
  const labelClass = 'block mb-1.5 text-xs font-semibold text-gray-600'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">기본 정보</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>프로그램명 *</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => {
                update('title', e.target.value)
                if (!isEdit && !form.slug) update('slug', autoSlug(e.target.value))
              }}
              required
            />
          </div>
          <div>
            <label className={labelClass}>URL 슬러그 *</label>
            <input
              className={inputClass}
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder="2026-leadership-workshop"
              required
            />
          </div>
          <div>
            <label className={labelClass}>유형 *</label>
            <select
              className={inputClass}
              value={form.program_type}
              onChange={(e) => update('program_type', e.target.value as OfflineProgramType)}
            >
              {(Object.keys(OFFLINE_PROGRAM_TYPE_LABEL) as OfflineProgramType[]).map((t) => (
                <option key={t} value={t}>{OFFLINE_PROGRAM_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>카테고리</label>
            <select
              className={inputClass}
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
            >
              <option value="">미지정</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>썸네일 URL</label>
            <input
              className={inputClass}
              value={form.thumbnail_url}
              onChange={(e) => update('thumbnail_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>설명</label>
            <textarea
              className={inputClass}
              rows={4}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="프로그램 소개 (마크다운 지원 — Phase 1 에선 plain text)"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">강사 정보</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>강사명</label>
            <input
              className={inputClass}
              value={form.instructor_name}
              onChange={(e) => update('instructor_name', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>강사 소개</label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.instructor_bio}
              onChange={(e) => update('instructor_bio', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">상세</h2>

        <div className="mb-4">
          <label className={labelClass}>학습 목표</label>
          <ArrayEditor
            items={form.what_you_learn}
            onAdd={() => addArrayItem('what_you_learn')}
            onChange={(i, v) => updateArrayItem('what_you_learn', i, v)}
            onRemove={(i) => removeArrayItem('what_you_learn', i)}
            placeholder="예: 단계별 피드백 코칭법 습득"
          />
        </div>

        <div className="mb-4">
          <label className={labelClass}>사전 요구사항</label>
          <ArrayEditor
            items={form.requirements}
            onAdd={() => addArrayItem('requirements')}
            onChange={(i, v) => updateArrayItem('requirements', i, v)}
            onRemove={(i) => removeArrayItem('requirements', i)}
            placeholder="예: 기본 노트북 지참"
          />
        </div>

        <div>
          <label className={labelClass}>대상</label>
          <textarea
            className={inputClass}
            rows={2}
            value={form.target_audience}
            onChange={(e) => update('target_audience', e.target.value)}
            placeholder="예: 신임 팀장 / 5년차 이상 매니저"
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-navy">노출 / 수료</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>상태 *</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => update('status', e.target.value as OfflineProgramStatus)}
            >
              {(Object.keys(OFFLINE_PROGRAM_STATUS_LABEL) as OfflineProgramStatus[]).map((s) => (
                <option key={s} value={s}>{OFFLINE_PROGRAM_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>수료 출석률 (%) *</label>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={form.completion_attendance_rate}
              onChange={(e) => update('completion_attendance_rate', Number(e.target.value))}
              required
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={form.is_featured}
                onChange={(e) => update('is_featured', e.target.checked)}
              />
              추천 노출 (목록 상단)
            </label>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || deleting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-silver"
            disabled={submitting || deleting}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || deleting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting ? '저장 중...' : isEdit ? '저장' : '생성'}
          </button>
        </div>
      </div>
    </form>
  )
}

function ArrayEditor({
  items, onAdd, onChange, onRemove, placeholder,
}: {
  items: string[]
  onAdd: () => void
  onChange: (i: number, v: string) => void
  onRemove: (i: number) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label="삭제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex w-fit items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-accent hover:text-accent"
      >
        <Plus className="h-3 w-3" /> 항목 추가
      </button>
    </div>
  )
}
