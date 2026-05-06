-- =====================================================
-- Phase 5 — block_types.banner 정의 갱신
-- =====================================================
-- 변경: banner 블록 fields 에 'items' 추가 (banner_items 타입).
--   PageBuilder 가 BannerEditor 모달을 띄워 multi-item 편집.
--   각 item: title / image_url / link_url / link_target.
--
-- 안전: ON CONFLICT DO UPDATE — 재실행 가능, 운영자 데이터 영향 없음
--      (block_types 는 메타 정의, content_blocks 의 실제 데이터와 별개).
-- =====================================================

INSERT INTO block_types (id, label, description, fields, sort_order) VALUES
  ('banner', '배너 슬롯', '이미지 배너 1개 또는 여러 개 묶음 (single / grid / slider)', '[
    {"name":"layout","type":"select","label":"레이아웃","options":["single","grid","slider"]},
    {"name":"items","type":"banner_items","label":"배너 항목"}
  ]'::jsonb, 20)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  fields = EXCLUDED.fields,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 검증:
--   SELECT id, fields FROM block_types WHERE id='banner';
--   → fields 에 items (type=banner_items) 가 포함돼야 정상
-- =====================================================
