/**
 * 영상 URL 을 분석해서 어떤 플랫폼인지, 그리고 영상 ID 가 무엇인지 판별합니다.
 *
 * - YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 * - Vimeo:   vimeo.com/ID, player.vimeo.com/video/ID
 * - HTML5:   .mp4 / .webm / .ogg / .mov 등 직접 파일
 */

export type VideoSourceType = 'html5' | 'youtube' | 'vimeo' | 'unknown'

export interface VideoSource {
  type: VideoSourceType
  id?: string   // youtube videoId, vimeo numeric id
  url: string   // 원본 url
}

export function detectVideoSource(url: string | null | undefined): VideoSource {
  if (!url) return { type: 'unknown', url: '' }
  const safeUrl = url.trim()

  // ───── YouTube ─────
  // youtu.be/ID
  let m = safeUrl.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)
  if (m) return { type: 'youtube', id: m[1], url: safeUrl }
  // youtube.com/watch?v=ID
  m = safeUrl.match(/[?&]v=([A-Za-z0-9_-]{6,})/)
  if (m && /youtube\.com/.test(safeUrl)) return { type: 'youtube', id: m[1], url: safeUrl }
  // youtube.com/embed/ID, youtube.com/shorts/ID
  m = safeUrl.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,})/)
  if (m) return { type: 'youtube', id: m[1], url: safeUrl }

  // ───── Vimeo ─────
  // player.vimeo.com/video/ID
  m = safeUrl.match(/player\.vimeo\.com\/video\/(\d+)/)
  if (m) return { type: 'vimeo', id: m[1], url: safeUrl }
  // vimeo.com/ID
  m = safeUrl.match(/vimeo\.com\/(\d+)/)
  if (m) return { type: 'vimeo', id: m[1], url: safeUrl }

  // ───── HTML5 (직접 파일 또는 그 밖의 임의 URL) ─────
  if (/\.(mp4|webm|ogg|ogv|mov|m3u8)(\?|$)/i.test(safeUrl)) {
    return { type: 'html5', url: safeUrl }
  }

  // 외부 URL 인데 위 패턴 모두 미일치 → html5 로 시도
  if (/^https?:\/\//.test(safeUrl)) {
    return { type: 'html5', url: safeUrl }
  }

  return { type: 'unknown', url: safeUrl }
}
