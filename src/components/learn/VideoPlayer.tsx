'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { CheckCircle } from 'lucide-react'

interface VideoPlayerProps {
  lessonId: string
  courseId: string
  videoUrl: string | null
  initialWatchedSeconds?: number
  onComplete?: () => void
  onProgressSave?: (seconds: number) => void
}

function isExternalUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function isYouTube(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be')
}

function isVimeo(url: string) {
  return url.includes('vimeo.com')
}

function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1` : url
}

function getVimeoEmbedUrl(url: string) {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? `https://player.vimeo.com/video/${match[1]}` : url
}

export function VideoPlayer({
  lessonId, courseId, videoUrl, initialWatchedSeconds = 0, onComplete, onProgressSave,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveProgress = useCallback(async (watchedSeconds: number, isCompleted = false) => {
    setSaving(true)
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, courseId, watchedSeconds, isCompleted }),
      })
      const data = await res.json()
      if (data.courseCompleted) onComplete?.()
      onProgressSave?.(watchedSeconds)
    } finally {
      setSaving(false)
    }
  }, [lessonId, courseId, onComplete, onProgressSave])

  // HTML5 video — 10초마다 진도 저장
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // 이전 시청 위치로 이동
    if (initialWatchedSeconds > 10) {
      video.currentTime = initialWatchedSeconds
    }

    const handleTimeUpdate = () => {
      if (saveTimerRef.current) return
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        saveProgress(Math.floor(video.currentTime))
      }, 10000)
    }

    const handleEnded = () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
      setCompleted(true)
      saveProgress(Math.floor(video.duration), true)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [lessonId, initialWatchedSeconds, saveProgress])

  if (!videoUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-navy/10">
        <p className="text-gray-400">영상이 준비 중입니다.</p>
      </div>
    )
  }

  const isExternal = isExternalUrl(videoUrl)
  const isYT = isExternal && isYouTube(videoUrl)
  const isVM = isExternal && isVimeo(videoUrl)

  if (isYT) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={getYouTubeEmbedUrl(videoUrl)}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="강의 영상"
        />
      </div>
    )
  }

  if (isVM) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={getVimeoEmbedUrl(videoUrl)}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="강의 영상"
        />
      </div>
    )
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2 text-white">
            <CheckCircle className="h-12 w-12 text-green-400" />
            <p className="font-semibold">강의 완료!</p>
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
