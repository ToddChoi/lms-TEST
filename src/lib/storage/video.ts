/**
 * course-videos 버킷이 private 으로 바뀌면 저장된 video_url 들이 그대로는
 * 재생 안 됨. 이 헬퍼가 양쪽 형식 모두 처리:
 *
 *   1) 외부 URL (youtube/vimeo)             → 그대로 반환
 *   2) supabase storage 의 public URL        → path 추출 → signed URL 발급
 *   3) bucket-relative path ("courseId/...")  → signed URL 발급
 *
 * 사용처: 서버 컴포넌트에서 lesson.video_url 을 LearnContent 로 전달하기 직전.
 * client 코드에는 항상 signed URL (또는 외부 URL) 만 노출됨.
 *
 * TTL: 6시간 — 한 학습 세션이 보통 그 안에 끝남. 너무 짧으면 재로드 빈번,
 * 너무 길면 leak 위험. 추후 사용 패턴 보고 조정.
 */
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'course-videos'
const TTL_SECONDS = 60 * 60 * 6  // 6h

function isExternal(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url)
}

/**
 * 입력이 supabase storage 와 관련이 있다면 path 를 뽑아 반환, 아니면 null.
 * - "https://xxx.supabase.co/storage/v1/object/public/course-videos/{path}"
 * - "https://xxx.supabase.co/storage/v1/object/sign/course-videos/{path}?token=..."
 *   (signed URL 을 다시 사인하는 경우 — TTL 갱신)
 * - "{path}" 형태 (bucket 내 상대 경로)
 */
function extractStoragePath(rawUrl: string): string | null {
  if (!rawUrl) return null
  // 절대 URL 이면 storage 경로인지 확인
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    const marker = `/object/public/${BUCKET}/`
    const signMarker = `/object/sign/${BUCKET}/`
    let idx = rawUrl.indexOf(marker)
    if (idx >= 0) return rawUrl.slice(idx + marker.length).split('?')[0]
    idx = rawUrl.indexOf(signMarker)
    if (idx >= 0) return rawUrl.slice(idx + signMarker.length).split('?')[0]
    return null
  }
  // 상대 경로 — courseId/timestamp_filename 형태로 가정
  return rawUrl.replace(/^\/+/, '')
}

/**
 * lesson.video_url 을 클라이언트로 보내기 전에 호출.
 * 서버 컴포넌트 / route handler 에서만 사용.
 */
export async function signVideoUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null
  if (isExternal(rawUrl)) return rawUrl

  const path = extractStoragePath(rawUrl)
  if (!path) {
    // storage 와 무관한 알 수 없는 형식 — 그대로 반환 (admin 이 직접 호스팅 한 경우 등)
    return rawUrl
  }

  const admin = createAdminClient()
  const { data, error } = await (admin as any).storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('[signVideoUrl] failed:', { path, error })
    return null
  }
  return data.signedUrl as string
}
