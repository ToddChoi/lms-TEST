-- =====================================================
-- Phase 5 — banner 블록 sizing 설정 추가
-- =====================================================
-- 운영자가 빌더에서 비율(aspect_ratio) + 최대 높이(max_height_px) 조정 가능.
-- default 도 더 임팩트 있는 값으로 변경 (21/9, 16/9).
--
-- 안전: ON CONFLICT DO UPDATE — 재실행 가능, content_blocks 데이터 영향 없음.
-- =====================================================

INSERT INTO block_types (id, label, description, fields, sort_order) VALUES
  ('banner', '배너 슬롯', '이미지 배너 1개 또는 여러 개 묶음 (single / grid / slider). 비율·최대 높이 조정 가능.', '[
    {"name":"layout","type":"select","label":"레이아웃","options":["single","grid","slider"]},
    {"name":"items","type":"banner_items","label":"배너 항목"},
    {"name":"aspect_ratio","type":"select","label":"비율","options":["21/9","16/9","16/7","5/2","3/1","5/1","1/1","custom"]},
    {"name":"aspect_custom","type":"text","label":"커스텀 비율 (aspect_ratio=custom 일 때, 예: 16/9 또는 1280:540)"},
    {"name":"max_height_px","type":"number","label":"최대 높이 (px) — 비워두면 무제한 (예: 600)"}
  ]'::jsonb, 20)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  fields = EXCLUDED.fields,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 검증:
--   SELECT id, jsonb_pretty(fields) FROM block_types WHERE id='banner';
--   → fields 에 5개 (layout, items, aspect_ratio, aspect_custom, max_height_px)
-- =====================================================
