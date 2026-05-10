'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Trash2, Copy, CheckCircle } from 'lucide-react'

interface MediaAsset {
  id: string
  url: string
  alt: string | null
  kind: 'image' | 'video' | 'pdf' | 'other'
  size_bytes: number | null
  created_at: string
}

export function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
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
      reload()
    } catch (e: any) {
      setError(e?.message ?? '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 이미지를 삭제할까요? 사용 중인 블록은 깨질 수 있습니다.')) return
    await fetch('/api/admin/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    reload()
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) handleUpload(f)
        }}
        className="cursor-pointer rounded-lg border-2 border-dashed border-border-subtle bg-surface p-8 text-center transition hover:border-accent hover:bg-accent-pale/40"
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-body-sm font-medium text-navy">
          {uploading ? '업로드 중...' : '클릭 또는 드래그로 이미지 업로드'}
        </p>
        <p className="mt-1 text-caption text-gray-500">PNG/JPG/WebP/SVG · 5MB 이하</p>
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
      </div>

      {error && (
        <div className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-caption text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-body-sm text-gray-500">불러오는 중...</p>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center text-body-sm text-gray-500">
          아직 업로드된 이미지가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {assets.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-md border border-border-subtle bg-surface"
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.alt ?? ''} className="h-full w-full object-cover" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => handleCopy(a.url)}
                  title="URL 복사"
                  className="flex h-7 w-7 items-center justify-center rounded-sm bg-white/90 text-navy hover:bg-white"
                >
                  {copied === a.url ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  title="삭제"
                  className="flex h-7 w-7 items-center justify-center rounded-sm bg-white/90 text-danger hover:bg-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-micro text-gray-400">
        ⓘ 페이지 빌더의 이미지 필드에서도 동일 라이브러리에서 picker 로 선택 가능합니다.
      </p>
    </div>
  )
}
