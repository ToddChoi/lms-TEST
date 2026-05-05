import { SurfaceBlocks } from '@/components/blocks/SurfaceBlocks'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ingrow LMS — AI·실무 역량 강화 이러닝 플랫폼',
  description: '기업과 개인을 위한 맞춤형 AI·실무 교육 플랫폼. 최신 강좌로 성장하세요.',
}

export const revalidate = 60

/**
 * 홈 — Phase 5 풀 빌더.
 *
 * 콘텐츠 (hero / featured / categories / stats / partner_logos / testimonials 등) 모두
 * content_blocks 에서. 운영자는 /admin/cms/builder/home 에서 편집.
 *
 * 회사 subdomain (예: acme.ingrow.com) 진입 시 SurfaceBlocks 가 회사 전용 블록 우선 노출
 * (Phase 4 multi-tenant). audience 필터로 비로그인/로그인/매니저 분기 자동.
 *
 * 기존 home_sections 시스템은 시드 마이그레이션을 통해 content_blocks 로 이전.
 * 점진 정리: home_sections 테이블은 한동안 유지하다 향후 별도 라운드에서 제거 예정.
 */
export default async function HomePage() {
  return (
    <div className="flex flex-col">
      <SurfaceBlocks surface="home" />
    </div>
  )
}
