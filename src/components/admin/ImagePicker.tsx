'use client'

/**
 * 이미지 단일 선택 — 미디어 라이브러리에서 픽 또는 새로 업로드.
 * PageBuilder 의 image field 에서 사용.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, Search } from 'lucide-react'

interface Asset {
  id: string
  url: string
  alt: string | null
}

interface Props {
  current: string
  onClose: () => void
  onConfirm: (url: string) => void
}

export function ImagePicker({ current, onClose, onConfirm }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string>(current)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/media?kind=image')
    const { assets } = await res.json()
    setAssets(assets ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleUpload = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '업로드 실패')
      setSelected(json.asset.url)
      reload()
    } catch (e: any) {
      setError(e?.message ?? '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-lg bg-surface p-5 shadow-elev-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-h5 text-navy">이미지 선택</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-surface-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* URL 직접 입력 */}
        <div className="mt-3 flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://... (외부 URL 직접 사용)"
            className="flex-1 rounded-md border border-border-subtle bg-surface px-3 py-2 text-body-sm focus:border-accent focus:outline-none"
          />
          <button
            onClick={() => onConfirm(urlInput.trim())}
            disabled={!urlInput.trim()}
            className="rounded-md border border-accent bg-surface px-3 py-2 text-body-sm text-accent hover:bg-accent-pale disabled:opacity-50"
          >
            URL 사용
          </button>
        </div>

        {/* 신규 업로드 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-subtle bg-surface-subtle py-3 text-body-sm font-medium text-navy hover:border-accent hover:bg-accent-pale/40"
        >
          <Upload className="h-4 w-4" /> {uploading ? '업로드 중...' : '새 이미지 업로드'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ''
          }}
        />
        {error && <p className="mt-2 text-caption text-danger">{error}</p>}

        {/* 라이브러리 grid */}
        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          <p className="mb-2 text-caption text-gray-500">미디어 라이브러리에서 선택</p>
          {loading ? (
            <p className="py-4 text-center text-body-sm text-gray-500">불러오는 중...</p>
          ) : assets.length === 0 ? (
            <p className="py-4 text-center text-body-sm text-gray-500">업로드된 이미지가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.url)}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 transition ${
                    selected === a.url ? 'border-accent ring-2 ring-accent/30' : 'border-border-subtle hover:border-gray-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.alt ?? ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-body-sm text-gray-500 hover:bg-surface-muted">
            취소
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={!selected}
            className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50"
          >
            선택
          </button>
        </div>
      </div>
    </div>
  )
}
