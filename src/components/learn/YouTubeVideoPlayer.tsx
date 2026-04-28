'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, RotateCcw } from 'lucide-react'
import { saveProgress } from '@/lib/progress'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

interface Props {
  videoId: string
  lessonId: string
  courseId: string
  initialWatchedSeconds: number
  isInitiallyCompleted: boolean
  onComplete?: () => void
  onProgressSave?: (seconds: number) => void
}

const SCRIPT_SRC = 'https://www.youtube.com/iframe_api'
let scriptLoadingPromise: Promise<void> | null = null

function loadYouTubeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise<void>((resolve) => {
    // 이미 로드된 콜백이 있을 수 있음 → 체이닝
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev()
      resolve()
    }
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const tag = document.createElement('script')
      tag.src = SCRIPT_SRC
      tag.async = true
      document.head.appendChild(tag)
    }
  })
  return scriptLoadingPromise
}

export function YouTubeVideoPlayer({
  videoId,
  lessonId,
  courseId,
  initialWatchedSeconds,
  isInitiallyCompleted,
  onComplete,
  onProgressSave,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const completedRef = useRef(isInitiallyCompleted)
  const [completed, setCompleted] = useState(isInitiallyCompleted)
  const [saving, setSaving] = useState(false)
  const startSeconds = isInitiallyCompleted ? 0 : initialWatchedSeconds

  useEffect(() => {
    let mounted = true

    loadYouTubeScript().then(() => {
      if (!mounted || !containerRef.current) return

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          start: startSeconds > 10 ? Math.floor(startSeconds) : 0,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: () => {
            if (startSeconds > 10) {
              try { playerRef.current?.seekTo(startSeconds, true) } catch {}
            }
          },
          onStateChange: (e: any) => {
            // 1: PLAYING, 0: ENDED
            if (e.data === 1) startPolling()
            else stopPolling()
            if (e.data === 0) {
              completedRef.current = true
              setCompleted(true)
              const duration = safeNumber(() => playerRef.current?.getDuration())
              fireSave(duration, duration, true)
              onComplete?.()
            }
          },
        },
      })
    })

    function startPolling() {
      if (pollRef.current) return
      pollRef.current = setInterval(() => {
        const t = safeNumber(() => playerRef.current?.getCurrentTime())
        const d = safeNumber(() => playerRef.current?.getDuration())
        fireSave(t, d, false)
      }, 1000) // 1초마다 체크하되, saveProgress 내부 5초 throttle 적용
    }
    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    async function fireSave(watched: number, duration: number, force: boolean) {
      if (!watched || isNaN(watched)) return
      if (!force && completedRef.current) return
      setSaving(true)
      try {
        const result = await saveProgress({
          lessonId, courseId,
          watchedSeconds: watched,
          duration,
          isCompleted: force ? true : undefined,
        })
        if (result.ok) onProgressSave?.(Math.floor(watched))
        if (result.courseCompleted) onComplete?.()
      } finally {
        setSaving(false)
      }
    }

    return () => {
      mounted = false
      stopPolling()
      try { playerRef.current?.destroy?.() } catch {}
    }
  // videoId / lessonId 가 바뀌면 새 플레이어 (LearnContent 가 key 로 리마운트하지만 안전망)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, lessonId, courseId])

  function handleRewatch() {
    completedRef.current = false
    setCompleted(false)
    try {
      playerRef.current?.seekTo(0, true)
      playerRef.current?.playVideo()
    } catch {}
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        {saving && (
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
            저장 중…
          </div>
        )}
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
      </div>
    </div>
  )
}

function safeNumber(getter: () => number): number {
  try {
    const v = getter()
    return typeof v === 'number' && !isNaN(v) ? v : 0
  } catch {
    return 0
  }
}
