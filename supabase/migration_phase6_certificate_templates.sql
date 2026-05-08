-- =====================================================
-- Phase 6 — 수료증 템플릿 시스템
-- =====================================================
-- 목적: 관리자가 수료증을 커스터마이즈 (텍스트/이미지/직인 위치 + 동적 데이터).
--       기존 hardcoded CertificatePDF 를 elements JSONB 로 일반화.
--
-- 좌표 단위: pt (PDF). A4 landscape = 842 × 595 pt.
-- elements 각 항목 schema (TypeScript 와 동기):
--   { id, type: 'text'|'image'|'rect', x, y, w, h, ... type-specific }
--
-- text:  content (문자열, {{placeholder}} 치환), font_size, font_weight, color, align
-- image: url, opacity?
-- rect:  fill?, border?, radius?
--
-- placeholder 키:
--   {{recipient_name}}, {{course_title}}, {{course_duration}},
--   {{enrolled_at}}, {{completed_at}}, {{cert_number}}, {{instructor_name}}
-- =====================================================

CREATE TABLE IF NOT EXISTS certificate_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  -- 페이지: A4 landscape / portrait
  page_size       TEXT NOT NULL DEFAULT 'A4' CHECK (page_size IN ('A4','letter')),
  page_orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (page_orientation IN ('landscape','portrait')),
  background_url  TEXT,                                   -- 배경 이미지 (옵션)
  background_color TEXT NOT NULL DEFAULT '#FFFFFF',
  elements        JSONB NOT NULL DEFAULT '[]'::JSONB,     -- 위 schema 따라
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,         -- 시스템 기본 (1개만 true)
  scope_type      cms_scope NOT NULL DEFAULT 'global',
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 시스템 기본 템플릿은 정확히 1개 (선택 안 하면 이걸로)
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_templates_default
  ON certificate_templates ((1)) WHERE is_default = TRUE AND scope_type = 'global';

CREATE INDEX IF NOT EXISTS idx_certificate_templates_scope
  ON certificate_templates(scope_type, company_id);

ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- 읽기: 인증된 사용자 누구나 (자기 수료증 렌더에 필요)
DROP POLICY IF EXISTS ct_read ON certificate_templates;
CREATE POLICY ct_read ON certificate_templates
  FOR SELECT TO authenticated USING (true);

-- 쓰기: admin/superadmin 만
DROP POLICY IF EXISTS ct_admin_write ON certificate_templates;
CREATE POLICY ct_admin_write ON certificate_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
  );

-- updated_at 트리거 (Phase 4 에서 만든 함수 재사용)
DROP TRIGGER IF EXISTS ct_set_updated_at ON certificate_templates;
CREATE TRIGGER ct_set_updated_at
BEFORE UPDATE ON certificate_templates
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- 기존 certificates 에 template_id 추가 — 어떤 템플릿으로 발급됐는지 추적
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL;

-- ─── 기본 템플릿 시드 ────────────────────────────────
DO $$
DECLARE
  v_default_id UUID;
BEGIN
  SELECT id INTO v_default_id FROM certificate_templates WHERE is_default = TRUE AND scope_type = 'global' LIMIT 1;
  IF v_default_id IS NOT NULL THEN
    RAISE NOTICE '기본 템플릿 이미 존재 — skip';
    RETURN;
  END IF;

  -- A4 landscape (842 × 595 pt) 기준 element 좌표.
  -- 기존 CertificatePDF 의 디자인을 elements 로 분해.
  INSERT INTO certificate_templates (
    name, description, page_size, page_orientation,
    background_color, is_default, elements
  ) VALUES (
    'Ingrow 기본', '시스템 기본 수료증 템플릿', 'A4', 'landscape', '#FFFFFF', TRUE,
    jsonb_build_array(
      -- navy 헤더 영역 (rect)
      jsonb_build_object(
        'id','header-bg','type','rect',
        'x',0,'y',0,'w',842,'h',110,'fill','#0B1F3A'
      ),
      -- 헤더 — INGROW LMS 작은 라벨
      jsonb_build_object(
        'id','brand','type','text',
        'x',40,'y',30,'w',300,'h',14,
        'content','INGROW LMS','font_size',9,'color','#8AA8CC','align','left'
      ),
      -- 헤더 — 수료증 큰 글씨
      jsonb_build_object(
        'id','title','type','text',
        'x',40,'y',46,'w',400,'h',38,
        'content','수료증','font_size',26,'font_weight','bold','color','#FFFFFF','align','left'
      ),
      -- 헤더 — Certificate of Completion
      jsonb_build_object(
        'id','title-en','type','text',
        'x',40,'y',82,'w',400,'h',14,
        'content','Certificate of Completion','font_size',10,'color','#8AA8CC','align','left'
      ),
      -- 본문 안내문
      jsonb_build_object(
        'id','intro','type','text',
        'x',60,'y',150,'w',722,'h',16,
        'content','아래 학습자가 과정을 성공적으로 수료하였음을 증명합니다.',
        'font_size',10,'color','#666666','align','center'
      ),
      -- 수료자 라벨
      jsonb_build_object(
        'id','recipient-label','type','text',
        'x',60,'y',180,'w',722,'h',12,
        'content','수료자','font_size',9,'color','#888888','align','center'
      ),
      -- 수료자 이름 (dynamic)
      jsonb_build_object(
        'id','recipient-name','type','text',
        'x',60,'y',196,'w',722,'h',32,
        'content','{{recipient_name}}','font_size',26,'font_weight','bold','color','#0B1F3A','align','center'
      ),
      -- 강좌 박스 배경
      jsonb_build_object(
        'id','course-bg','type','rect',
        'x',141,'y',252,'w',560,'h',60,'fill','#F4F6FA','radius',8
      ),
      -- 강좌 라벨
      jsonb_build_object(
        'id','course-label','type','text',
        'x',141,'y',262,'w',560,'h',12,
        'content','수료 과정','font_size',9,'color','#888888','align','center'
      ),
      -- 강좌명 (dynamic)
      jsonb_build_object(
        'id','course-title','type','text',
        'x',141,'y',278,'w',560,'h',24,
        'content','{{course_title}}','font_size',15,'font_weight','bold','color','#0B1F3A','align','center'
      ),
      -- 학습 시간 (dynamic)
      jsonb_build_object(
        'id','course-duration','type','text',
        'x',141,'y',322,'w',560,'h',14,
        'content','학습 시간 · {{course_duration}}','font_size',10,'color','#374151','align','center'
      ),
      -- 신청일
      jsonb_build_object(
        'id','enrolled-label','type','text',
        'x',60,'y',390,'w',230,'h',12,
        'content','수강 신청일','font_size',9,'color','#888888','align','left'
      ),
      jsonb_build_object(
        'id','enrolled-value','type','text',
        'x',60,'y',404,'w',230,'h',14,
        'content','{{enrolled_at}}','font_size',11,'color','#374151','align','left'
      ),
      -- 수료일
      jsonb_build_object(
        'id','completed-label','type','text',
        'x',306,'y',390,'w',230,'h',12,
        'content','수료일','font_size',9,'color','#888888','align','left'
      ),
      jsonb_build_object(
        'id','completed-value','type','text',
        'x',306,'y',404,'w',230,'h',14,
        'content','{{completed_at}}','font_size',11,'color','#374151','align','left'
      ),
      -- 수료증 번호
      jsonb_build_object(
        'id','cert-num-label','type','text',
        'x',552,'y',390,'w',230,'h',12,
        'content','수료증 번호','font_size',9,'color','#888888','align','left'
      ),
      jsonb_build_object(
        'id','cert-num-value','type','text',
        'x',552,'y',404,'w',230,'h',14,
        'content','{{cert_number}}','font_size',11,'color','#374151','align','left'
      ),
      -- 발급기관 (footer 중앙)
      jsonb_build_object(
        'id','issuer','type','text',
        'x',60,'y',540,'w',722,'h',14,
        'content','발급기관 · Ingrow LMS  •  ingrow.co.kr',
        'font_size',9,'color','#16A34A','align','center'
      )
    )
  );

  RAISE NOTICE '기본 수료증 템플릿 시드 완료';
END $$;

-- =====================================================
-- 검증:
--   SELECT id, name, is_default, jsonb_array_length(elements) AS elem_count
--   FROM certificate_templates;
-- =====================================================
