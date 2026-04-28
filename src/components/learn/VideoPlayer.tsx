'use client'

import { detectVideoSource } from '@/lib/video-source'
import { HTML5VideoPlayer } from './HTML5VideoPlayer'
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer'
import { VimeoVideoPlayer } from './VimeoVideoPlayer'

interface VideoPlayerProps {
  lessonId: string
  courseId: string
  videoUrl: string | null
  initialWatchedSeconds?: number
  isInitiallyCompleted?: boolean
  onComplete?: () => void
  onProgressSave?: (seconds: number) => void
}

/**
 * 영상 URL 종류(html5 / youtube / vimeo)에 따라
 * 적절한 플레이어로 자동 분기합니다.
 *
 * 모든 플레이어는 `@/lib/progress.ts` 의 `saveProgress` 를 통해
 * 5초 throttle + 90% 자동완료 규칙으로 진도를 서버에 저장합니다.
 */
export function VideoPlayer({
  lessonId,
  courseId,
  videoUrl,
  initialWatchedSeconds = 0,
  isInitiallyCompleted = false,
  onComplete,
  onProgressSave,
}: VideoPlayerProps) {
  if (!videoUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-navy/10">
        <p className="text-gray-400">영상이 준비 중입니다.</p>
      </div>
    )
  }

  const source = detectVideoSource(videoUrl)
  const common = {
    lessonId,
    courseId,
    initialWatchedSeconds,
    isInitiallyCompleted,
    onComplete,
    onProgressSave,
  }

  if (source.type === 'youtube' && source.id) {
    return <YouTubeVideoPlayer videoId={source.id} {...common} />
  }
  if (source.type === 'vimeo' && source.id) {
    return <VimeoVideoPlayer videoId={source.id} {...common} />
  }
  // html5 또는 unknown URL → HTML5 플레이어로 시도
  return <HTML5VideoPlayer videoUrl={source.url} {...common} />
}
