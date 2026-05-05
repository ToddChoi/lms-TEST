-- =====================================================
-- Phase 5 — 홈 페이지 풀 빌더 마이그레이션
-- =====================================================
-- 목적:
--   /  페이지가 100% content_blocks 로 동작하도록 기본 홈 블록 시드.
--   기존 home_sections 시스템은 한동안 유지 (둘 다 살아 있음 — 점진 폐기).
--
-- 안전:
--   surface='home' AND scope_type='global' 의 블록이 0개 일 때만 INSERT.
--   재실행 안전.
-- =====================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM content_blocks
  WHERE surface='home' AND scope_type='global';

  IF v_count > 0 THEN
    RAISE NOTICE 'home (global) 블록 % 개 존재 — skip', v_count;
    RETURN;
  END IF;

  -- 1) Hero
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type) VALUES
  ('home', 'hero', '{
    "heading": "성장하는 사람들의 이러닝 플랫폼",
    "subheading": "AI·실무 역량 강화에 필요한 모든 강좌를 한 곳에서.",
    "cta_label": "전체 강좌 보기",
    "cta_url": "/courses",
    "variant": "centered"
  }'::jsonb, 10, 'published', 'global');

  -- 2) Featured courses (course_ids 비어 있음 — 운영자가 picker 로 채움)
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type) VALUES
  ('home', 'featured_courses', '{
    "heading": "추천 강좌",
    "subheading": "지금 가장 인기있는 강좌",
    "course_ids": [],
    "cta_url": "/courses"
  }'::jsonb, 20, 'published', 'global');

  -- 3) Categories
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type) VALUES
  ('home', 'categories', '{
    "heading": "카테고리"
  }'::jsonb, 30, 'published', 'global');

  -- 4) Feature grid — 핵심 가치
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type) VALUES
  ('home', 'feature_grid', '{
    "heading": "Ingrow 와 함께 빠르게 성장하세요",
    "items": [
      {"icon":"sparkles","title":"AI 추천","desc":"학습 이력 기반 맞춤 강좌 추천."},
      {"icon":"award","title":"수료증 발급","desc":"이수 강좌 자동 수료증."},
      {"icon":"users","title":"실무 커뮤니티","desc":"동료와 함께 학습 진척도 공유."},
      {"icon":"chart","title":"진도 대시보드","desc":"개인·팀 학습 현황 한눈에."}
    ],
    "columns": "4",
    "surface": "silver"
  }'::jsonb, 40, 'published', 'global');

  -- 5) Stats — 신뢰 숫자 (운영자가 실제 값으로 교체)
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status, scope_type) VALUES
  ('home', 'stats', '{
    "heading": "숫자로 보는 Ingrow",
    "items": [
      {"label":"누적 수강생","value":"1,200+","icon":"users"},
      {"label":"개설 강좌","value":"50+","icon":"book"},
      {"label":"평균 평점","value":"4.7","icon":"star"},
      {"label":"수료증 발급","value":"800+","icon":"award"}
    ]
  }'::jsonb, 50, 'published', 'global');

  RAISE NOTICE 'home (global) 시드 5 블록 완료';
END $$;

-- =====================================================
-- 검증:
--   SELECT sort_order, block_type, config->>'heading' as heading, status
--   FROM content_blocks
--   WHERE surface='home' AND scope_type='global'
--   ORDER BY sort_order;
--   → 5 row 떠야 정상.
--
-- 운영자 작업 (시드 후):
--   /admin/cms/builder/home 에서 추천 강좌 (course_ids) 를 picker 로 선택,
--   stats 의 value 를 실제 수치로 교체.
-- =====================================================
