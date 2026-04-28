'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, RotateCcw } from 'lucide-react'
import { saveProgress } from '@/lib/progress'

interface Props {
  lessonId: string
  courseId: string
  videoUrl: string
  initialWatchedSeconds: number
  isInitiallyCompleted: boolean
  onComplete?: () => void
  onProgressSave?: (seconds: number) => void
}

export function HTML5VideoPlayer({
  lessonId,
  courseId,
  videoUrl,
  initialWatchedSeconds,
  isInitiallyCompleted,
  onComplete,
  onProgressSave,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [completed, setCompleted] = useState(isInitiallyCompleted)
  const [saving, setSaving] = useState(false)

  const startSeconds = isInitiallyCompleted ? 0 : initialWatchedSeconds

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (startSeconds > 10) video.currentTime = startSeconds

    const handleTimeUpdate = async () => {
      const watched = Math.floor(video.currentTime)
      const duration = Math.floor(video.duration || 0)
      setSaving(true)
      try {
        const result = await saveProgress({ lessonId, courseId, watchedSeconds: watched, duration })
        if (result.ok) onProgressSave?.(watched)
        if (result.courseCompleted) onComplete?.()
      } finally {
        setSaving(false)
      }
    }

    const handleEnded = async () => {
      setCompleted(true)
      setSaving(true)
      try {
        const result = await saveProgress({
          lessonId, courseId,
          watchedSeconds: Math.floor(video.duration || 0),
          duration: Math.floor(video.duration || 0),
          isCompleted: true,
        })
        if (result.courseCompleted) onComplete?.()
      } finally {
        setSaving(false)
      }
      onComplete?.()
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [lessonId, courseId, startSeconds, onComplete, onProgressSave])

  function handleRewatch() {
    setCompleted(false)
    const video = videoRef.current
    if (video) {
      video.currentTime = 0
      video.play().catch(() => {})
    }
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="aspect-video w-full"
        controlsList="nodownload"
        playsInline
      />
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 text-white">
            <CheckCircle className="h-14 w-14 text-green-400" />
            <p className="text-lg font-semibold">강의 완료!</p>
            <button
              onClick={handleRewatch}
              className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 px-5 py-2.5 text-sm font-medium transition"
            >
              <RotateCcw className="h-4 w-4" /> 다시 보기
            </button>
          </div>
        </div>
      )}
      {saving && (
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
          저장 중…
        </div>
      )}
    </div>
  )
}
