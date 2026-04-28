-- ============================================================
-- Ingrow LMS — CMS 기능 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. categories: description, icon, updated_at 컬럼 추가
-- ─────────────────────────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────
-- 2. banners: 추가 컬럼
-- ─────────────────────────────────────────
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS link_target TEXT DEFAULT '_self',
  ADD COLUMN IF NOT EXISTS starts_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- 관리자가 비활성 배너도 조회할 수 있도록 admin read 정책 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'banners' AND policyname = 'banners: admin read all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "banners: admin read all" ON banners
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
          )
        )
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 3. site_settings: label, group_name 컬럼 추가
-- ─────────────────────────────────────────
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS label      TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT 'general';

-- 기존 설정에 label 및 group_name 업데이트
UPDATE site_settings SET label = '사이트 이름',   group_name = 'general'    WHERE key = 'site_name';
UPDATE site_settings SET label = '사이트 설명',   group_name = 'general'    WHERE key = 'site_description';
UPDATE site_settings SET label = '메인 컬러',     group_name = 'appearance' WHERE key = 'main_color';
UPDATE site_settings SET label = '로고 URL',      group_name = 'appearance' WHERE key = 'logo_url';

-- 추가 기본 설정 삽입 (이미 있으면 무시)
INSERT INTO site_settings (key, value, label, group_name) VALUES
  ('contact_email',    '',                                   '대표 이메일',   'contact'),
  ('contact_phone',    '',                                   '대표 전화',     'contact'),
  ('contact_address',  '',                                   '주소',          'contact'),
  ('footer_copyright', 'Ingrow LMS. All rights reserved.',  '저작권 문구',   'appearance'),
  ('og_image_url',     '',                                   'OG 이미지 URL', 'appearance'),
  ('favicon_url',      '',                                   '파비콘 URL',    'appearance')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- 4. menus: menu_type 값 통일
--    기존 'home' / 'side' → 'header'
-- ─────────────────────────────────────────
UPDATE menus SET menu_type = 'header' WHERE menu_type IN ('home', 'side');

-- footer 초기 메뉴 삽입 (없으면 추가)
INSERT INTO menus (label, href, sort_order, menu_type) VALUES
  ('강좌 목록',  '/courses',         1, 'footer'),
  ('기업 도입',  '/b2b',             2, 'footer'),
  ('공지사항',   '/notice',          3, 'footer'),
  ('FAQ',        '/faq',             4, 'footer'),
  ('이용문의',   '/contact',         5, 'footer'),
  ('마이페이지', '/my',              6, 'footer'),
  ('수료증',     '/my/certificates', 7, 'footer')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 5. home_sections 테이블 생성 (홈 섹션 CMS)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS home_sections (
  id          SERIAL PRIMARY KEY,
  section_key TEXT        NOT NULL UNIQUE,  -- 'hero' | 'stats' | 'featured_courses' | 'b2b_cta'
  title       TEXT,                          -- 관리자 화면 표시명
  is_visible  BOOLEAN     DEFAULT TRUE,
  sort_order  INT         DEFAULT 0,
  config      JSONB       DEFAULT '{}',      -- 섹션 별 설정값 (텍스트, 링크 등)
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE home_sections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'home_sections' AND policyname = 'home_sections: public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "home_sections: public read" ON home_sections
        FOR SELECT USING (TRUE)
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'home_sections' AND policyname = 'home_sections: admin write'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "home_sections: admin write" ON home_sections
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
          )
        )
    $policy$;
  END IF;
END $$;

-- home_sections 초기 데이터
INSERT INTO home_sections (section_key, title, is_visible, sort_order, config) VALUES
  (
    'hero',
    '히어로 섹션',
    TRUE,
    1,
    '{
      "badge": "AI·실무 역량 강화 플랫폼",
      "heading_line1": "성장하는 사람들의",
      "heading_line2": "이러닝 플랫폼",
      "subtext": "AI 활용부터 실무 역량까지. 체계적인 커리큘럼으로 당신의 커리어를 한 단계 높이세요.",
      "cta_primary_label": "강좌 둘러보기",
      "cta_primary_href": "/courses",
      "cta_secondary_label": "기업 도입 문의",
      "cta_secondary_href": "/b2b"
    }'::jsonb
  ),
  (
    'stats',
    '통계 섹션',
    TRUE,
    2,
    '{}'::jsonb
  ),
  (
    'featured_courses',
    '추천 강좌 섹션',
    TRUE,
    3,
    '{
      "title": "추천 강좌",
      "subtitle": "지금 인기 있는 강좌를 만나보세요",
      "limit": 6
    }'::jsonb
  ),
  (
    'b2b_cta',
    'B2B CTA 섹션',
    TRUE,
    4,
    '{
      "heading_line1": "임직원 교육,",
      "heading_line2": "이제 Ingrow LMS로 한 번에",
      "subtext": "기업 맞춤형 커리큘럼부터 학습 현황 관리까지. AI 시대에 필요한 실무 역량을 체계적으로 키워드립니다.",
      "cta_label": "기업 도입 상담 신청",
      "cta_href": "/b2b",
      "benefits": [
        "기업 맞춤형 강좌 커리큘럼 제공",
        "임직원 학습 현황 실시간 대시보드",
        "수료증 및 이수 현황 일괄 관리",
        "기업 전용 포털 및 브랜딩 지원"
      ]
    }'::jsonb
  )
ON CONFLICT (section_key) DO NOTHING;
