/**
 * 레거시 /admin/cms — Phase 5 까지 home_sections 기반 CMS 가 살아 있다가 정리됨.
 * 기존 북마크·링크 호환을 위해 페이지 빌더로 redirect.
 *
 * 빌더 진입점 (surface 선택) 으로 가는 게 자연스러움.
 */
import { redirect } from 'next/navigation'

export default function LegacyCmsRedirect() {
  redirect('/admin/cms/builder/home')
}
