-- =====================================================
-- Phase 1 — 디자인+CMS 고도화 토대 (다중 테넌시 + 페이지 빌더 + i18n)
-- =====================================================
-- 이 마이그레이션은 "스키마만" 도입. 코드는 점진 활용.
-- 모든 추가 컬럼은 nullable 또는 default — 기존 데이터/코드 무영향.
--
-- 포함:
--  1) white-label 토대 — companies 확장 + 5개 테이블에 scope/company_id
--  2) pages 테이블 — 약관/개인정보처리방침/회사 랜딩 등
--  3) content_blocks — home_sections 일반화 (P2 에서 활용)
--  4) media_assets — 미디어 라이브러리 (P5 에서 UI)
--  5) i18n 인프라 — translations 테이블 패턴
-- =====================================================

-- ─── 1. companies — white-label 정보 ──────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subdomain        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS primary_color    TEXT,           -- '#2D7DD2' 등 hex
  ADD COLUMN IF NOT EXISTS hero_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_white_label   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_domains    TEXT[] DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain) WHERE subdomain IS NOT NULL;

-- ─── 2. scope 컬럼 — global vs company 분리 ──────────
-- 'global' = 전체 공통 (회사별 override 없음 = 기본). 'company' = 회사 전용.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cms_scope') THEN
    CREATE TYPE cms_scope AS ENUM ('global', 'company');
  END IF;
END $$;

-- 5개 표면에 동일 패턴 적용 — 기존 row 는 모두 'global' 로 자동 분류.
ALTER TABLE home_sections
  ADD COLUMN IF NOT EXISTS scope_type cms_scope NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_home_sections_scope ON home_sections(scope_type, company_id);

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS scope_type cms_scope NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_banners_scope ON banners(scope_type, company_id);

ALTER TABLE nav_menus
  ADD COLUMN IF NOT EXISTS scope_type cms_scope NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_label TEXT;  -- footer 의 "서비스/고객지원" 그룹용
CREATE INDEX IF NOT EXISTS idx_nav_menus_scope ON nav_menus(scope_type, company_id);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS scope_type cms_scope NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
-- key 단독 PK 였다면 (scope_type, company_id, key) 복합 unique 가 필요
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_scoped_key_unique'
  ) THEN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_scoped_key_unique
      UNIQUE (scope_type, company_id, key);
  END IF;
END $$;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS scope_type cms_scope NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS color      TEXT,                 -- '#FF6A4D' 등
  ADD COLUMN IF NOT EXISTS image_url  TEXT;                 -- 이모지 외 카테고리 이미지

-- ─── 3. pages — 약관/개인정보/회사 전용 랜딩 ─────────
CREATE TABLE IF NOT EXISTS pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,                                      -- markdown 또는 rich text
  seo           JSONB DEFAULT '{}'::JSONB,                 -- {title, description, og_image, canonical, noindex}
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  scope_type    cms_scope NOT NULL DEFAULT 'global',
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  published_at  TIMESTAMPTZ,
  author_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 같은 scope 내에서는 slug 유니크. global 과 company 는 동일 slug 가능.
  UNIQUE (scope_type, company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_status_published ON pages(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_scope ON pages(scope_type, company_id);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY pages_public_read ON pages
  FOR SELECT USING (status = 'published');

CREATE POLICY pages_admin_all ON pages
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ─── 4. content_blocks — home_sections 일반화 ────────
-- P2 에서 본격 활용. 지금은 스키마만 만들어 두고 home_sections 는 그대로 유지.
-- 새 표면(/b2b, 회사 전용 랜딩 등)은 처음부터 content_blocks 사용.
CREATE TABLE IF NOT EXISTS content_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 어느 표면에 노출되는가: 'home' | 'b2b' | 'pages/<slug>' | 'company/<id>/home' 등
  surface       TEXT NOT NULL,
  block_type    TEXT NOT NULL,                            -- 'hero' | 'banner' | 'featured_courses' | 'company_collection' | ...
  config        JSONB NOT NULL DEFAULT '{}'::JSONB,       -- block_type 별 옵션
  audience      JSONB NOT NULL DEFAULT '{}'::JSONB,       -- {logged_in, company_id, interests_any, job_level} — P3
  sort_order    INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  scope_type    cms_scope NOT NULL DEFAULT 'global',
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_surface_sort
  ON content_blocks(surface, sort_order)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_content_blocks_scope ON content_blocks(scope_type, company_id);

ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_blocks_public_read ON content_blocks
  FOR SELECT USING (
    status = 'published'
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

CREATE POLICY content_blocks_admin_all ON content_blocks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- block_types — 메타 스키마 driven 빌더 (P2 에서 드로어 자동 생성에 사용)
CREATE TABLE IF NOT EXISTS block_types (
  id            TEXT PRIMARY KEY,                          -- 'hero' | 'banner' | ...
  label         TEXT NOT NULL,                             -- 운영자 UI 표시명
  description   TEXT,
  fields        JSONB NOT NULL DEFAULT '[]'::JSONB,        -- [{name, type, label, required, options}, ...]
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE block_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY block_types_admin_read ON block_types
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );
CREATE POLICY block_types_admin_write ON block_types
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ─── 5. media_assets — 미디어 라이브러리 ─────────────
CREATE TABLE IF NOT EXISTS media_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT NOT NULL,                             -- storage path 또는 외부 URL
  bucket        TEXT,                                      -- storage 버킷명 (외부면 NULL)
  kind          TEXT NOT NULL,                             -- 'image' | 'video' | 'pdf' | 'other'
  alt           TEXT,
  width         INT,
  height        INT,
  size_bytes    BIGINT,
  tags          TEXT[] DEFAULT '{}'::TEXT[],
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scope_type    cms_scope NOT NULL DEFAULT 'global',
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_kind_created ON media_assets(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_scope ON media_assets(scope_type, company_id);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_assets_admin_all ON media_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ─── 6. i18n 인프라 — translations 테이블 ────────────
-- 패턴: 콘텐츠는 ko 컬럼에 그대로 저장 (현행 유지). 추가 언어가 들어오면 이 테이블에 row 추가.
-- 코드는 fallback 패턴: lang === 'ko' → 원본 / 그 외 → translations 조회 후 없으면 ko fallback.
CREATE TABLE IF NOT EXISTS translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 어느 테이블의 어느 컬럼의 어느 row 인지
  table_name    TEXT NOT NULL,                             -- 'courses' | 'categories' | 'pages' | ...
  row_id        TEXT NOT NULL,                             -- UUID 또는 정수 ID 를 문자열로
  column_name   TEXT NOT NULL,                             -- 'title' | 'description' | 'body'
  lang          TEXT NOT NULL,                             -- 'en' | 'ja' | 'zh' (ko 는 원본 — 저장 안 함)
  value         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (table_name, row_id, column_name, lang)
);

CREATE INDEX IF NOT EXISTS idx_translations_lookup
  ON translations(table_name, row_id, lang);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY translations_public_read ON translations
  FOR SELECT USING (true);   -- 번역은 콘텐츠와 함께 공개되는 게 정상
CREATE POLICY translations_admin_write ON translations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- ─── 7. 시드 — 기본 block_types 등록 ──────────────────
INSERT INTO block_types (id, label, description, fields, sort_order) VALUES
  ('hero', 'Hero 섹션', '페이지 최상단 메인 배너', '[
    {"name":"heading","type":"text","label":"헤드라인","required":true},
    {"name":"subheading","type":"text","label":"서브 카피"},
    {"name":"cta_label","type":"text","label":"버튼 라벨"},
    {"name":"cta_url","type":"text","label":"버튼 링크"},
    {"name":"bg_image","type":"image","label":"배경 이미지"},
    {"name":"variant","type":"select","label":"레이아웃","options":["centered","split","video"]}
  ]'::jsonb, 10),
  ('banner', '배너 슬롯', '여러 배너 묶음', '[
    {"name":"layout","type":"select","label":"레이아웃","options":["single","slider","grid"]}
  ]'::jsonb, 20),
  ('featured_courses', '추천 강좌', '강좌 카드 그리드', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"course_ids","type":"course_picker","label":"강좌 선택"},
    {"name":"limit","type":"number","label":"최대 노출 수"}
  ]'::jsonb, 30),
  ('categories', '카테고리 그리드', '카테고리 클릭 진입점', '[
    {"name":"heading","type":"text","label":"섹션 제목"}
  ]'::jsonb, 40),
  ('stats', '숫자 강조', '신뢰 지표 — 수강생/기업/평점', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"items","type":"json","label":"항목 배열 [{label,value,icon}]"}
  ]'::jsonb, 50),
  ('partner_logos', '도입 기업 로고 wall', 'B2B 신뢰 시그널', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"logos","type":"json","label":"[{name,logo_url,url}]"}
  ]'::jsonb, 60),
  ('testimonials', '수강생 후기', '소셜프루프', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"items","type":"json","label":"[{name,company,quote,avatar_url}]"}
  ]'::jsonb, 70),
  ('company_collection', '회사 전용 큐레이션', 'B2B 차별화 — P3 활용', '[
    {"name":"heading","type":"text","label":"섹션 제목"},
    {"name":"company_id","type":"company_picker","label":"대상 회사"},
    {"name":"course_ids","type":"course_picker","label":"강좌 선택"}
  ]'::jsonb, 80),
  ('custom_html', '커스텀 HTML', '비상용 — 가능하면 다른 블록 사용', '[
    {"name":"html","type":"textarea","label":"HTML"}
  ]'::jsonb, 99)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  fields = EXCLUDED.fields,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 검증 (별도 SQL):
--   SELECT subdomain, primary_color FROM companies LIMIT 5;
--   SELECT scope_type, COUNT(*) FROM home_sections GROUP BY scope_type;
--   SELECT id, label FROM block_types ORDER BY sort_order;
--   SELECT COUNT(*) FROM pages;
--   SELECT COUNT(*) FROM media_assets;
--   SELECT COUNT(*) FROM translations;
-- =====================================================
