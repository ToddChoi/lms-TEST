import { describe, it, expect } from 'vitest'
import { extractStoragePath, isExternal } from './video'

describe('isExternal', () => {
  it('detects youtube/vimeo URLs', () => {
    expect(isExternal('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isExternal('https://youtu.be/abc')).toBe(true)
    expect(isExternal('https://vimeo.com/123')).toBe(true)
  })
  it('returns false for storage URLs / paths', () => {
    expect(isExternal('https://x.supabase.co/storage/v1/object/public/course-videos/c/1_a.mp4')).toBe(false)
    expect(isExternal('courseId/1234_video.mp4')).toBe(false)
    expect(isExternal('')).toBe(false)
  })
})

describe('extractStoragePath', () => {
  it('extracts path from public URL', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/course-videos/courseA/1234_intro.mp4'
    expect(extractStoragePath(url)).toBe('courseA/1234_intro.mp4')
  })

  it('extracts path from signed URL (preserves token-stripping)', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/course-videos/courseB/567_demo.mp4?token=xyz'
    expect(extractStoragePath(url)).toBe('courseB/567_demo.mp4')
  })

  it('returns relative path as-is', () => {
    expect(extractStoragePath('courseA/1234_video.mp4')).toBe('courseA/1234_video.mp4')
  })

  it('strips leading slashes from relative path', () => {
    expect(extractStoragePath('/courseA/file.mp4')).toBe('courseA/file.mp4')
  })

  it('returns null for unknown absolute URL (not storage)', () => {
    expect(extractStoragePath('https://example.com/some/path.mp4')).toBeNull()
    expect(extractStoragePath('https://www.youtube.com/watch?v=abc')).toBeNull()
  })

  it('handles different bucket name in URL — must NOT match course-videos extractor', () => {
    // banners 버킷의 public URL 이 잘못 들어와도 course-videos path 로 인식하지 않음
    const url = 'https://abc.supabase.co/storage/v1/object/public/banners/img.png'
    expect(extractStoragePath(url)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(extractStoragePath('')).toBeNull()
  })
})
