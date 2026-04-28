-- ============================================================
-- Ingrow LMS — CMS v2 마이그레이션
-- 기존 CMS 테이블을 UUID 기반으로 완전히 교체합니다.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ─────────────────────────────────────────
-- 0. 기존 테이블 제거 (의존성 역순)
-- ─────────────────────────────────────────
DROP TABLE IF EXISTS banners        CASCADE;
DROP TABLE IF EXISTS home_sections  CASCADE;
DROP TABLE IF EXISTS menus          CASCADE;
DROP TABLE IF EXISTS categories     CASCADE;

-- ─────────────────────────────────────────
-- 1. nav_menus (헤더 / 푸터 네비게이션)
-- ─────────────────────────────────────────
CREATE TABLE nav_menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location    TEXT NOT NULL CHECK (location IN ('header', 'footer')),
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  target      TEXT NOT NULL DEFAULT '_self' CHECK (target IN ('_self', '_blank')),
  sort_order  INT  NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- 2. home_sections (홈 페이지 섹션)
-- type 에 CHECK 없음 → 프론트에서 허용 타입 관리
-- label: 관리자 식별용 이름 (동일 타입 중복 허용)
-- ─────────────────────────────────────────
CREATE TABLE home_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  title       TEXT,
  subtitle    TEXT,
  sort_order  INT  NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- 3. banners (banner 타입 섹션에 종속)
-- 섹션 삭제 시 배너도 CASCADE 삭제
-- ─────────────────────────────────────────
CREATE TABLE banners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   UUID NOT NULL REFERENCES home_sections(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT '',
  image_url    TEXT,
  link_url     TEXT,
  link_target  TEXT NOT NULL DEFAULT '_self',
  sort_order   INT  NOT NULL DEFAULT 0,
  is_visible   BOOLEAN NOT NULL DEFAULT true,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- 4. categories
-- ─────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INT  NOT NULL DEFAULT 0,
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- courses.category_id 컬럼 타입 변경 (int → uuid)
ALTER TABLE courses DROP COLUMN IF EXISTS category_id;
ALTER TABLE courses ADD COLUMN category_id UUID REFERENCES categories(id);

-- ─────────────────────────────────────────
-- 5. site_settings 보완 (기존 테이블 유지)
-- ─────────────────────────────────────────
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS label      TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT 'general';

INSERT INTO site_settings (key, value, label, group_name) VALUES
  ('site_name',         'Ingrow LMS',        '사이트명',         'general'),
  ('site_description',  '',                  '사이트 설명',      'general'),
  ('logo_url',          '',                  '로고 URL',         'general'),
  ('favicon_url',       '',                  '파비콘 URL',       'general'),
  ('footer_text',       '© 2026 Ingrow LMS', '푸터 저작권 문구', 'general'),
  ('primary_color',     '#4F46E5',           '메인 컬러',        'appearance'),
  ('contact_email',     '',                  '문의 이메일',      'contact'),
  ('kakao_channel_url', '',                  '카카오 채널 URL',  'contact')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- 6. 기본 네비게이션 메뉴 삽입
-- ─────────────────────────────────────────
INSERT INTO nav_menus (location, label, url, sort_order) VALUES
  ('header', '강좌',     '/courses', 1),
  ('header', '공지사항', '/notice',  2),
  ('header', 'FAQ',      '/faq',     3),
  ('header', '기업 도입','/b2b',     4),
  ('header', '문의하기', '/contact', 5);

INSERT INTO nav_menus (location, label, url, sort_order) VALUES
  ('footer', '강좌 목록',  '/courses',         1),
  ('footer', '기업 도입',  '/b2b',             2),
  ('footer', '공지사항',   '/notice',          3),
  ('footer', 'FAQ',        '/faq',             4),
  ('footer', '이용문의',   '/contact',         5),
  ('footer', '마이페이지', '/my',              6),
  ('footer', '수료증',     '/my/certificates', 7);

-- ─────────────────────────────────────────
-- 7. 기본 홈 섹션 삽입
-- ─────────────────────────────────────────
INSERT INTO home_sections (type, label, title, sort_order, is_visible, config) VALUES
  ('hero', '메인 히어로', '메인 히어로', 1, true,
   '{"heading":"성장하는 사람들의 이러닝 플랫폼","subheading":"AI 활용부터 실무 역량까지. 체계적인 커리큘럼으로 당신의 커리어를 한 단계 높이세요.","cta_label":"강좌 둘러보기","cta_url":"/courses","cta_secondary_label":"기업 도입 문의","cta_secondary_url":"/b2b"}'),
  ('banner', '메인 배너', NULL, 2, true,
   '{"autoplay":true,"interval":5000,"show_arrows":true,"show_dots":true}'),
  ('featured_courses', '추천 강좌', '추천 강좌', 3, true,
   '{"limit":6,"filter":"is_featured","title":"추천 강좌","subtitle":"지금 인기 있는 강좌를 만나보세요"}'),
  ('categories', '카테고리', '카테고리', 4, true,
   '{"limit":8,"title":"카테고리"}'),
  ('stats', '주요 지표', '주요 지표', 5, true,
   '{"show_students":true,"show_courses":true,"show_companies":true}');

-- ─────────────────────────────────────────
-- 8. RLS 정책
-- ─────────────────────────────────────────
ALTER TABLE nav_menus    ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories   ENABLE ROW LEVEL SECURITY;

-- 공개 읽기
CREATE POLICY "nav_menus: public read"
  ON nav_menus FOR SELECT USING (true);

CREATE POLICY "home_sections: public read"
  ON home_sections FOR SELECT USING (true);

CREATE POLICY "banners: public read"
  ON banners FOR SELECT USING (true);

CREATE POLICY "categories: public read"
  ON categories FOR SELECT USING (true);

-- 관리자 전체 권한
CREATE POLICY "nav_menus: admin all"
  ON nav_menus FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

CREATE POLICY "home_sections: admin all"
  ON home_sections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

CREATE POLICY "banners: admin all"
  ON banners FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

CREATE POLICY "categories: admin all"
  ON categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')));

-- ─────────────────────────────────────────
-- 9. reorder RPC (UUID 배열)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reorder_home_sections(p_ids UUID[])
RETURNS VOID AS $$
DECLARE i INT;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE home_sections SET sort_order = i, updated_at = now() WHERE id = p_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reorder_nav_menus(p_ids UUID[])
RETURNS VOID AS $$
DECLARE i INT;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE nav_menus SET sort_order = i, updated_at = now() WHERE id = p_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
