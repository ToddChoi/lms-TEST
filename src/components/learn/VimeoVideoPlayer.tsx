'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, RotateCcw } from 'lucide-react'
import Player from '@vimeo/player'
import { saveProgress } from '@/lib/progress'

interface Props {
  videoId: string
  lessonId: string
  courseId: string
  initialWatchedSeconds: number
  isInitiallyCompleted: boolean
  onComplete?: () => void
  onProgressSave?: (seconds: number) => void
}

export function VimeoVideoPlayer({
  videoId,
  lessonId,
  courseId,
  initialWatchedSeconds,
  isInitiallyCompleted,
  onComplete,
  onProgressSave,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const completedRef = useRef(isInitiallyCompleted)
  const [completed, setCompleted] = useState(isInitiallyCompleted)
  const [saving, setSaving] = useState(false)

  const startSeconds = isInitiallyCompleted ? 0 : initialWatchedSeconds

  useEffect(() => {
    if (!wrapRef.current) return

    const player = new Player(wrapRef.current, {
      id: Number(videoId),
      responsive: true,
    })
    playerRef.current = player

    player.ready().then(() => {
      if (startSeconds > 10) {
        player.setCurrentTime(startSeconds).catch(() => {})
      }
    })

    let lastFire = 0
    const fireSave = async (watched: number, duration: number, isCompleted: boolean) => {
      if (!isCompleted) {
        const now = Date.now()
        if (now - lastFire < 1000) return // 너무 자주 도는 timeupdate 1차 가드
        lastFire = now
      }
      setSaving(true)
      try {
        const result = await saveProgress({
          lessonId, courseId,
          watchedSeconds: watched,
          duration,
          isCompleted: isCompleted ? true : undefined,
        })
        if (result.ok) onProgressSave?.(Math.floor(watched))
        if (result.courseCompleted) onComplete?.()
      } finally {
        setSaving(false)
      }
    }

    const onTimeUpdate = ({ seconds, duration }: { seconds: number; duration: number }) => {
      if (completedRef.current) return
      fireSave(seconds, duration, false)
    }
    const onEnded = async () => {
      completedRef.current = true
      setCompleted(true)
      const duration = await player.getDuration().catch(() => 0)
      await fireSave(duration, duration, true)
      onComplete?.()
    }

    player.on('timeupdate', onTimeUpdate)
    player.on('ended', onEnded)

    return () => {
      try {
        player.off('timeupdate', onTimeUpdate)
        player.off('ended', onEnded)
        player.destroy().catch(() => {})
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, lessonId, courseId])

  function handleRewatch() {
    completedRef.current = false
    setCompleted(false)
    playerRef.current?.setCurrentTime(0).catch(() => {})
    playerRef.current?.play().catch(() => {})
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <div ref={wrapRef} className="absolute inset-0 h-full w-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
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
