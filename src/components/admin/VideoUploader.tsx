'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, X, Film, CheckCircle, Loader2, Play } from 'lucide-react'

type Mode = 'url' | 'file'

interface Props {
  courseId: string
  value: string
  onChange: (url: string) => void
  onDurationDetected?: (seconds: number) => void   // 영상 길이 자동 감지 콜백 (초 단위)
}

// course-videos 가 private 으로 바뀐 후 video_url 은
//   - 새 업로드: bucket-relative path ("courseId/timestamp_name.mp4")
//   - 레거시   : 풀 public URL (...storage/v1/object/public/course-videos/...)
// 둘 다 "스토리지 영상" 으로 인식해야 함.
function isStoragePath(value: string) {
  if (!value) return false
  if (value.includes('course-videos')) return true                        // 레거시 URL
  return !/^https?:\/\//.test(value) && /^[^/]+\/\d+_/.test(value)        // path 패턴
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

function getFileNameFromValue(value: string): string {
  try {
    // path 형식: "courseId/1234_filename.mp4"
    const tail = value.split('/').pop() ?? value
    return tail.replace(/^\d+_/, '')
  } catch {
    return '업로드된 영상'
  }
}

const ACCEPTED = 'video/mp4,video/webm,video/quicktime,video/avi,video/x-matroska,video/x-m4v'
const ACCEPTED_EXT = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']
const MAX_MB = 50

export function VideoUploader({ courseId, value, onChange, onDurationDetected }: Props) {
  const initMode: Mode = value && isStoragePath(value) ? 'file' : 'url'
  const [mode, setMode] = useState<Mode>(initMode)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXT.includes(ext)) {
      setError(`지원되지 않는 형식입니다. 지원 형식: ${ACCEPTED_EXT.join(', ')}`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`파일 크기는 ${MAX_MB}MB 이하여야 합니다. (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    // ── 1. 영상 메타데이터에서 길이 자동 감지 ────────────────────
    if (onDurationDetected) {
      await new Promise<void>((resolve) => {
        const blobUrl = URL.createObjectURL(file)
        const tempVideo = document.createElement('video')
        tempVideo.preload = 'metadata'
        tempVideo.onloadedmetadata = () => {
          URL.revokeObjectURL(blobUrl)
          if (isFinite(tempVideo.duration) && tempVideo.duration > 0) {
            onDurationDetected(Math.round(tempVideo.duration))
          }
          resolve()
        }
        tempVideo.onerror = () => { URL.revokeObjectURL(blobUrl); resolve() }
        // 3초 이상 메타데이터를 못 읽으면 포기
        setTimeout(() => { URL.revokeObjectURL(blobUrl); resolve() }, 3000)
        tempVideo.src = blobUrl
      })
    }

    // ── 2. 서버에서 Signed URL 발급 (서비스 롤 사용) ─────────────
    const urlRes = await fetch('/api/admin/videos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        fileName: file.name,
        contentType: file.type || 'video/mp4',
      }),
    })

    if (!urlRes.ok) {
      const err = await urlRes.json()
      setError(err.error ?? '업로드 URL 발급 실패')
      setUploading(false)
      return
    }

    const { signedUrl, path } = await urlRes.json() as { signedUrl: string; path: string }

    // ── 2. XHR로 진행률 추적하며 Supabase Storage에 직접 업로드 ──
    const uploadErr = await new Promise<string | null>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(null)
        else resolve(`업로드 실패 (HTTP ${xhr.status})`)
      }
      xhr.onerror = () => resolve('네트워크 오류가 발생했습니다.')
      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
      xhr.send(file)
    })

    if (uploadErr) {
      setError(uploadErr)
      setUploading(false)
      return
    }

    // ── 3. 완료 — bucket-relative path 를 video_url 로 저장.
    //   재생 시점에 서버가 signed URL 로 변환해 노출함.
    onChange(path)
    setProgress(100)
    setUploading(false)
  }, [courseId, onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const ytId = mode === 'url' ? getYoutubeId(value) : null
  const isUploaded = value && isStoragePath(value)

  return (
    <div className="space-y-3">
      {/* 모드 토글 */}
      <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden text-sm">
        {(['url', 'file'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={`flex items-center gap-1.5 px-4 py-2 transition ${
              mode === m
                ? 'bg-[#2D7DD2] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {m === 'url' ? <Link2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {m === 'url' ? 'URL 입력' : '파일 업로드'}
          </button>
        ))}
      </div>

      {/* ── URL 모드 ── */}
      {mode === 'url' && (
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... 또는 Vimeo URL"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]"
            />
            {ytId && (
              <div
                className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black cursor-pointer group"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition">
                  <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shadow">
                    <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">YouTube, Vimeo, 기타 동영상 URL 지원</p>
        </div>
      )}

      {/* ── 파일 업로드 모드 ── */}
      {mode === 'file' && (
        <div className="space-y-2">
          {uploading ? (
            /* 업로드 중 */
            <div className="p-4 bg-[#E8F2FC] rounded-xl border border-[#2D7DD2]/20">
              <div className="flex items-center gap-2 mb-2.5">
                <Loader2 className="w-4 h-4 text-[#2D7DD2] animate-spin" />
                <span className="text-sm font-medium text-[#2D7DD2]">업로드 중 {progress}%</span>
              </div>
              <div className="w-full bg-[#2D7DD2]/20 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#2D7DD2] h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : isUploaded ? (
            /* 업로드 완료 */
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">
                  {getFileNameFromValue(value)}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  업로드 완료 — 학습 페이지에서 재생 확인 가능
                </p>
              </div>
              <button
                type="button"
                onClick={() => { onChange(''); setProgress(0) }}
                className="text-gray-400 hover:text-red-500 transition p-1 rounded"
                title="파일 제거"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* 드롭 영역 */
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-[#2D7DD2] bg-[#E8F2FC]/40 scale-[1.01]'
                  : 'border-gray-300 hover:border-[#2D7DD2] hover:bg-[#E8F2FC]/10'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Film className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">
                클릭하거나 파일을 드래그하여 업로드
              </p>
              <p className="text-xs text-gray-400 mt-1.5">
                MP4, WebM, MOV, AVI, MKV · 최대 {MAX_MB}MB
              </p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
              e.target.value = ''
            }}
          />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
