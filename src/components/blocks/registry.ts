/**
 * Block Registry — content_blocks 의 block_type 을 React 컴포넌트로 매핑.
 *
 * 새 블록 추가 흐름:
 *   1) supabase block_types 테이블에 row 추가 (id, label, fields JSON)
 *   2) 이 파일에 컴포넌트 import + REGISTRY 에 등록
 *   3) 끝.
 *
 * config 객체는 block_types.fields 의 스키마 따라 운영자가 admin 에서 입력.
 * 컴포넌트는 props 로 config 받음.
 */
import type { ComponentType } from 'react'
import { HeroBlock, type HeroConfig }                       from './HeroBlock'
import { FeaturedCoursesBlock, type FeaturedCoursesConfig } from './FeaturedCoursesBlock'
import { PartnerLogosBlock, type PartnerLogosConfig }       from './PartnerLogosBlock'
import { TestimonialsBlock, type TestimonialsConfig }       from './TestimonialsBlock'
import { StatsBlock, type StatsConfig }                     from './StatsBlock'
import { CategoriesBlock, type CategoriesConfig }           from './CategoriesBlock'
import { CustomHtmlBlock, type CustomHtmlConfig }           from './CustomHtmlBlock'
import { BannerBlock, type BannerConfig }                   from './BannerBlock'

export interface BlockProps<C = Record<string, unknown>> {
  config: C
  /** 미래 — audience 검사 결과나 user/company 같은 컨텍스트 전달용. P3 에서 채움. */
  context?: { userId?: string; companyId?: string }
}

// 등록된 모든 block_type 의 합집합. unknown 타입은 fallback 처리.
type AnyBlockComponent = ComponentType<BlockProps<any>>

export const REGISTRY: Record<string, AnyBlockComponent> = {
  hero:               HeroBlock as AnyBlockComponent,
  banner:             BannerBlock as AnyBlockComponent,
  featured_courses:   FeaturedCoursesBlock as AnyBlockComponent,
  categories:         CategoriesBlock as AnyBlockComponent,
  stats:              StatsBlock as AnyBlockComponent,
  partner_logos:      PartnerLogosBlock as AnyBlockComponent,
  testimonials:       TestimonialsBlock as AnyBlockComponent,
  company_collection: FeaturedCoursesBlock as AnyBlockComponent, // P4 에서 분기 — 지금은 동일
  custom_html:        CustomHtmlBlock as AnyBlockComponent,
}

export type BlockConfigMap = {
  hero:               HeroConfig
  banner:             BannerConfig
  featured_courses:   FeaturedCoursesConfig
  categories:         CategoriesConfig
  stats:              StatsConfig
  partner_logos:      PartnerLogosConfig
  testimonials:       TestimonialsConfig
  company_collection: FeaturedCoursesConfig
  custom_html:        CustomHtmlConfig
}

export function isKnownBlockType(t: string): boolean {
  return t in REGISTRY
}
