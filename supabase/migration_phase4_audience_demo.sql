-- =====================================================
-- Phase 4 Round 1 — audience 데모 (ACME 회사에 노출 분기 추가)
-- =====================================================
-- 목적: ACME tenant home 에 audience 별 분기 시연.
--   1) "비로그인 방문자" 용 hero (회사 도입 안내) — guest only
--   2) "ACME 멤버" 용 hero (이미 시드된 것, audience={logged_in:true, company_id:ACME}로 강화)
--   3) "ACME 매니저" 전용 추가 블록 (관리자 안내)
--
-- 안전: ACME 회사가 이미 존재해야 동작 (migration_phase4_demo_tenant.sql 선실행).
--       ACME home 블록이 0개 또는 audience 가 비어 있을 때만 보강.
-- =====================================================

DO $$
DECLARE
  v_acme UUID;
BEGIN
  SELECT id INTO v_acme FROM companies WHERE subdomain='acme';
  IF v_acme IS NULL THEN
    RAISE NOTICE 'ACME 회사 없음 — migration_phase4_demo_tenant.sql 먼저 실행하세요. skip.';
    RETURN;
  END IF;

  -- 기존 ACME hero 블록을 "로그인된 ACME 멤버" 만 보도록 audience 추가.
  -- (이미 audience 설정돼 있으면 덮어쓰지 않음 — 운영자 편집 보존)
  UPDATE content_blocks
  SET audience = jsonb_build_object(
    'logged_in', true,
    'company_id', v_acme::text
  )
  WHERE company_id = v_acme
    AND surface = 'home'
    AND block_type = 'hero'
    AND (audience = '{}'::jsonb OR audience IS NULL);

  -- 비로그인 ACME 도메인 방문자(=영업 잠재고객) 용 hero 추가.
  -- 같은 surface 의 비로그인 hero — guest only.
  IF NOT EXISTS (
    SELECT 1 FROM content_blocks
    WHERE company_id = v_acme AND surface='home' AND block_type='hero'
      AND audience->>'logged_in' = 'false'
  ) THEN
    INSERT INTO content_blocks (
      surface, block_type, config, audience, sort_order, status, scope_type, company_id
    ) VALUES (
      'home',
      'hero',
      jsonb_build_object(
        'heading',    'ACME 임직원이신가요?',
        'subheading', '회사 이메일로 로그인하시면 부서별 학습 콘텐츠를 받아보실 수 있습니다.',
        'cta_label',  '로그인',
        'cta_url',    '/login',
        'variant',    'centered'
      ),
      jsonb_build_object('logged_in', false),
      5,                                  -- sort_order: 로그인 hero(10) 보다 먼저
      'published',
      'company',
      v_acme
    );
    RAISE NOTICE 'ACME guest hero 추가';
  ELSE
    RAISE NOTICE 'ACME guest hero 이미 존재 — skip';
  END IF;

  -- ACME 매니저 전용 안내 — 매니저만 보이는 cta 블록.
  IF NOT EXISTS (
    SELECT 1 FROM content_blocks
    WHERE company_id = v_acme AND surface='home'
      AND audience->>'is_company_manager' = 'true'
  ) THEN
    INSERT INTO content_blocks (
      surface, block_type, config, audience, sort_order, status, scope_type, company_id
    ) VALUES (
      'home',
      'cta',
      jsonb_build_object(
        'heading',    '매니저용 학습 현황 대시보드',
        'subheading', '소속 직원의 학습 진도와 수료율을 한눈에 보세요.',
        'bullets',    jsonb_build_array('부서별 진도 리포트', 'CSV 일괄 다운로드', '미수강자 자동 알림'),
        'cta_label',  '대시보드 열기',
        'cta_url',    '/org/admin',
        'variant',    'inverted'
      ),
      jsonb_build_object(
        'logged_in', true,
        'is_company_manager', true,
        'company_id', v_acme::text
      ),
      40,
      'published',
      'company',
      v_acme
    );
    RAISE NOTICE 'ACME 매니저 전용 cta 추가';
  END IF;
END $$;

-- =====================================================
-- 검증 시나리오:
--   1) 비로그인 + ACME 도메인 (acme.ingrow.com 또는 ?tenant=acme):
--      → "ACME 임직원이신가요?" hero 만 노출
--   2) 로그인 + ACME 멤버:
--      → "ACME 임직원 학습 포털..." hero + feature_grid + cta
--   3) 로그인 + ACME 매니저:
--      → 위 + "매니저용 학습 현황 대시보드" 추가 노출
--
-- 검증 쿼리:
--   SELECT sort_order, block_type, audience, config->>'heading' as heading
--   FROM content_blocks
--   WHERE company_id=(SELECT id FROM companies WHERE subdomain='acme')
--   ORDER BY sort_order;
-- =====================================================
