-- =====================================================
-- Phase 2 후속 — block_types 추가 (feature_grid, cta) + /b2b 시드
-- =====================================================
-- 목적:
--  1) feature_grid / cta 두 block_type 등록
--  2) 기존 하드코딩된 /b2b 콘텐츠를 content_blocks 로 이전
--     → /b2b 페이지가 100% 빌더 driven 으로 동작
--
-- 안전:
--  - block_types 는 ON CONFLICT DO UPDATE — 재실행 가능
--  - /b2b 시드는 surface='b2b' 의 row 가 0개 일 때만 INSERT (재실행 안전)
-- =====================================================

-- ─── 1. 새 block_types 등록 ──────────────────────────
INSERT INTO block_types (id, label, description, fields, sort_order) VALUES
  ('feature_grid', '혜택/기능 카드 grid', '아이콘+제목+설명 카드 2~4열', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"subheading","type":"text","label":"서브 카피"},
    {"name":"items","type":"json","label":"카드 배열 [{icon,title,desc}]  icon 키: users/book/chart/award/building/graduation/check/star/sparkles/shield/zap/target"},
    {"name":"columns","type":"select","label":"열 수","options":["2","3","4"]},
    {"name":"surface","type":"select","label":"배경","options":["silver","white"]}
  ]'::jsonb, 35),
  ('cta', 'CTA 행동 유도', '제목+체크리스트+버튼', '[
    {"name":"heading","type":"text","label":"제목"},
    {"name":"subheading","type":"text","label":"부제"},
    {"name":"bullets","type":"json","label":"체크 항목 (문자열 배열) [\"무료 데모\",\"전담 CS\"]"},
    {"name":"cta_label","type":"text","label":"버튼 라벨"},
    {"name":"cta_url","type":"text","label":"버튼 링크"},
    {"name":"variant","type":"select","label":"스타일","options":["soft","inverted"]}
  ]'::jsonb, 75)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  fields = EXCLUDED.fields,
  sort_order = EXCLUDED.sort_order;

-- ─── 2. /b2b 시드 — 기존 하드코딩 콘텐츠 이전 ───────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM content_blocks WHERE surface = 'b2b';
  IF v_count > 0 THEN
    RAISE NOTICE 'b2b 시드 skip — 이미 % 개 블록 존재', v_count;
    RETURN;
  END IF;

  -- Hero
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status) VALUES
  ('b2b', 'hero', '{
    "heading": "임직원 교육,\nIngrow LMS로 한 번에",
    "subheading": "기업 맞춤형 커리큘럼부터 학습 현황 관리까지. AI 시대에 필요한 실무 역량을 체계적으로 키워드립니다.",
    "cta_label": "아래에서 상담 신청하기 ↓",
    "cta_url": "#b2b-form",
    "variant": "centered"
  }'::jsonb, 10, 'published');

  -- Feature grid (혜택)
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status) VALUES
  ('b2b', 'feature_grid', '{
    "heading": "기업 도입 혜택",
    "items": [
      {"icon":"users","title":"임직원 통합 관리","desc":"소속 임직원의 수강 현황을 한눈에 관리하세요."},
      {"icon":"book","title":"맞춤형 커리큘럼","desc":"기업 니즈에 맞는 강좌를 선별·구성할 수 있습니다."},
      {"icon":"chart","title":"학습 현황 대시보드","desc":"부서별·개인별 학습 진도와 수료율을 실시간으로 확인."},
      {"icon":"award","title":"수료증 일괄 발급","desc":"이수 완료 임직원에게 수료증을 자동 발급합니다."}
    ],
    "columns": "4",
    "surface": "silver"
  }'::jsonb, 20, 'published');

  -- CTA (상담 안내 — 폼 자체는 페이지 코드의 B2BContactForm 이 담당)
  INSERT INTO content_blocks (surface, block_type, config, sort_order, status) VALUES
  ('b2b', 'cta', '{
    "heading": "지금 바로 도입 상담을 신청하세요",
    "subheading": "담당자가 빠르게 연락드립니다.",
    "bullets": ["무료 데모 제공", "도입 후 전담 CS 지원", "기업 규모에 맞는 요금제"],
    "variant": "soft"
  }'::jsonb, 30, 'published');

  RAISE NOTICE 'b2b 시드 완료 — 3 블록';
END $$;

-- =====================================================
-- 검증:
--   SELECT sort_order, block_type, status, config->>'heading' as heading
--   FROM content_blocks WHERE surface='b2b' ORDER BY sort_order;
-- =====================================================
