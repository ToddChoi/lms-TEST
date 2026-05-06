'use client'

/**
 * 배너 항목 multi-item 에디터.
 * PageBuilder 의 banner_items 필드 type 에서 사용.
 *
 * 각 항목: 제목 / 이미지 (ImagePicker) / 링크 / target
 * 추가/삭제/순서 변경 (위/아래) 지원.
 */
import { useState } from 'react'
import { X, Plus, ChevronUp, ChevronDown, Trash2, Image as ImageIcon } from 'lucide-react'
import { ImagePicker } from './ImagePicker'

interface BannerItem {
  title: string
  image_url?: string
  link_url?: string
  link_target?: string
}

interface Props {
  initial: BannerItem[]
  onClose: () => void
  onConfirm: (items: BannerItem[]) => void
}

export function BannerEditor({ initial, onClose, onConfirm }: Props) {
  const [items, setItems] = useState<BannerItem[]>(initial.length > 0 ? initial : [])
  const [pickingFor, setPickingFor] = useState<number | null>(null)

  const update = (i: number, patch: Partial<BannerItem>) =>
    setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const remove = (i: number) =>
    setItems((arr) => arr.filter((_, idx) => idx !== i))

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    setItems(next)
  }

  const add = () =>
    setItems((arr) => [...arr, { title: '', image_url: '', link_url: '', link_target: '_self' }])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-lg bg-surface p-5 shadow-elev-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-h5 text-navy">배너 항목 편집</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-caption text-gray-500">
          이미지 / 링크 / 제목 을 항목별로 입력합니다. layout=single 은 첫 항목만, grid/slider 는 모두 노출.
        </p>

        <ul className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
          {items.length === 0 && (
            <li className="rounded-md border border-dashed border-border-subtle p-8 text-center text-body-sm text-gray-500">
              아직 배너 항목이 없습니다. 아래 &ldquo;항목 추가&rdquo; 로 시작하세요.
            </li>
          )}
          {items.map((it, i) => (
            <li key={i} className="rounded-md border border-border-subtle bg-surface-subtle p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-caption font-mono text-gray-400">#{i + 1}</span>
                <div className="flex items-center gap-1">
                  <IconBtn title="위로"   onClick={() => move(i, -1)} disabled={i === 0}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn title="아래로" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn title="삭제" onClick={() => remove(i)} danger>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr]">
                {/* 이미지 미리보기 + picker */}
                <button
                  type="button"
                  onClick={() => setPickingFor(i)}
                  className="flex aspect-[5/1] sm:aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface hover:border-accent"
                  title="이미지 선택"
                >
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                <div className="space-y-2">
                  <input
                    value={it.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="제목 (이미지 없을 때 fallback / 접근성 alt)"
                    className="w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      value={it.link_url ?? ''}
                      onChange={(e) => update(i, { link_url: e.target.value })}
                      placeholder="클릭 시 이동 URL (https://... 또는 /path)"
                      className="flex-1 rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
                    />
                    <select
                      value={it.link_target ?? '_self'}
                      onChange={(e) => update(i, { link_target: e.target.value })}
                      className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-body-sm focus:border-accent focus:outline-none"
                    >
                      <option value="_self">현재 창</option>
                      <option value="_blank">새 창</option>
                    </select>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3">
          <button
            type="button"
            onClick={add}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border-subtle bg-surface-subtle py-2 text-body-sm font-medium text-navy hover:border-accent hover:bg-accent-pale/40"
          >
            <Plus className="h-4 w-4" /> 항목 추가
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">
            취소
          </button>
          <button
            onClick={() => onConfirm(items)}
            className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light"
          >
            {items.length}개 저장
          </button>
        </div>

        {pickingFor !== null && (
          <ImagePicker
            current={items[pickingFor]?.image_url ?? ''}
            onClose={() => setPickingFor(null)}
            onConfirm={(url) => {
              update(pickingFor, { image_url: url })
              setPickingFor(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

function IconBtn({
  children, title, onClick, disabled, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1 text-gray-500 transition hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? 'hover:bg-danger-soft hover:text-danger' : ''
      }`}
    >
      {children}
    </button>
  )
}
