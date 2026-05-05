-- =====================================================
-- Phase 4 — 데모 회사 (multi-tenant) 시드
-- =====================================================
-- 목적: subdomain='acme' 회사 1개 + 전용 home 블록 + 전용 b2b 블록 시드.
-- 사용:
--   - production: acme.ingrow.com 으로 진입 → 자동으로 ACME 색·로고·블록 노출
--   - 개발 / 프리뷰: ?tenant=acme 쿼리 → 동일하게 노출
--
-- 안전:
--   - companies 는 ON CONFLICT (subdomain) DO UPDATE — 재실행 가능
--   - 블록 시드는 회사 ID 기준 0개일 때만 INSERT
-- =====================================================

DO $$
DECLARE
  v_company_id UUID;
  v_block_count INT;
BEGIN
  -- 1) 데모 회사 upsert
  INSERT INTO companies (
    name, subdomain, primary_color, logo_url, hero_image_url, is_white_label, is_active, email_domains
  ) VALUES (
    'ACME 데모',
    'acme',
    '#FF6A4D',                                                          -- 오렌지 — 기본 사이트 navy/blue 와 명확히 다른 색
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Logo_TV_2015.svg/200px-Logo_TV_2015.svg.png',  -- placeholder 로고 (실제 운영 시 교체)
    NULL,
    TRUE,
    TRUE,
    ARRAY['acme.com', 'acme-corp.com']                                  -- 가입 시 자동 매칭에 사용 (P4 후속)
  )
  ON CONFLICT (subdomain) DO UPDATE SET
    name = EXCLUDED.name,
    primary_color = EXCLUDED.primary_color,
    logo_url = EXCLUDED.logo_url,
    is_white_label = EXCLUDED.is_white_label,
    is_active = EXCLUDED.is_active,
    email_domains = EXCLUDED.email_domains
  RETURNING id INTO v_company_id;

  RAISE NOTICE 'ACME company id: %', v_company_id;

  -- 2) 회사 전용 home 블록 시드 (이미 있으면 skip)
  SELECT COUNT(*) INTO v_block_count
  FROM content_blocks
  WHERE surface='home' AND scope_type='company' AND company_id=v_company_id;

  IF v_block_count = 0 THEN
    INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type, company_id) VALUES
    ('home', 'hero', '{
      "heading": "ACME 임직원 학습 포털에 오신 것을 환영합니다",
      "subheading": "회사 직무 체계에 맞게 큐레이션된 강좌로 빠르게 성장하세요.",
      "cta_label": "이번 분기 추천 강좌 보기",
      "cta_url": "/courses",
      "variant": "centered"
    }'::jsonb, 10, 'published', 'company', v_company_id),

    ('home', 'feature_grid', '{
      "heading": "ACME 학습 가이드",
      "items": [
        {"icon":"target","title":"분기별 목표","desc":"우리 부서의 학습 목표가 자동 큐레이션 됩니다."},
        {"icon":"users","title":"팀 학습 현황","desc":"동료들이 학습 중인 강좌를 함께 보세요."},
        {"icon":"award","title":"수료증","desc":"이수 강좌의 수료증이 인사기록에 자동 반영됩니다."},
        {"icon":"sparkles","title":"AI 추천","desc":"이전 학습 이력 기반으로 다음 강좌를 추천합니다."}
      ],
      "columns": "4",
      "surface": "white"
    }'::jsonb, 20, 'published', 'company', v_company_id),

    ('home', 'cta', '{
      "heading": "도움이 필요하신가요?",
      "subheading": "교육담당팀이 빠르게 도와드립니다.",
      "bullets": ["문의 응답 24시간 내", "맞춤 학습 경로 추천", "관리자 보고용 데이터 제공"],
      "cta_label": "교육담당팀 문의",
      "cta_url": "/contact",
      "variant": "soft"
    }'::jsonb, 30, 'published', 'company', v_company_id);

    RAISE NOTICE 'ACME home 블록 3개 시드';
  ELSE
    RAISE NOTICE 'ACME home 블록 이미 % 개 존재 — skip', v_block_count;
  END IF;
END $$;

-- =====================================================
-- 검증:
--   SELECT name, subdomain, primary_color FROM companies WHERE subdomain='acme';
--   SELECT sort_order, block_type, config->>'heading' FROM content_blocks
--     WHERE company_id=(SELECT id FROM companies WHERE subdomain='acme')
--     ORDER BY surface, sort_order;
--
-- 배포 검증:
--   1) Vercel 프로젝트의 도메인 설정에 acme.ingrow.com (또는 *.your-domain) 추가
--   2) acme.ingrow.com 접속 → ACME 페이지 + 오렌지 컬러
--   또는 개발 환경: http://localhost:3000/?tenant=acme
-- =====================================================
