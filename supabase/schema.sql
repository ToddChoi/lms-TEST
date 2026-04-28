-- ============================================================
-- Ingrow LMS 2.0 — Supabase 스키마
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- ============================================================

-- ─────────────────────────────────────────
-- 4-1. profiles (사용자 프로필)
-- ─────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'student', -- student|instructor|admin|superadmin
  avatar_url  TEXT,
  phone       TEXT,
  company     TEXT,
  department  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인만 자신의 프로필 수정 가능
CREATE POLICY "profiles: self update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 본인 또는 관리자는 조회 가능
CREATE POLICY "profiles: admin read" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- 가입 시 자동 삽입용 정책 (트리거에서 service_role로 처리)
CREATE POLICY "profiles: insert own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 회원가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────
-- 4-2. categories (강좌 카테고리)
-- ─────────────────────────────────────────
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO categories (name, slug, sort_order) VALUES
  ('AI 직무/업무 생산성', 'ai', 1),
  ('실무 역량', 'business', 2),
  ('메타버스', 'metaverse', 3),
  ('자격증', 'certificate', 4);


-- ─────────────────────────────────────────
-- 4-3. courses (강좌)
-- ─────────────────────────────────────────
CREATE TABLE courses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  thumbnail_url   TEXT,
  category_id     INT REFERENCES categories(id),
  instructor_id   UUID REFERENCES profiles(id),
  price           INT DEFAULT 0,           -- 원 단위, 0이면 무료
  enroll_start    DATE,                    -- 수강 신청 시작
  enroll_end      DATE,                    -- 수강 신청 마감
  learn_start     DATE,                    -- 학습 시작일
  learn_end       DATE,                    -- 학습 종료일
  review_days     INT DEFAULT 0,           -- 복습 기간 (일)
  total_duration  INT DEFAULT 0,           -- 총 학습 시간(초)
  level           TEXT DEFAULT 'all',      -- beginner|intermediate|advanced|all
  status          TEXT DEFAULT 'draft',    -- draft|active|closed
  is_featured     BOOLEAN DEFAULT FALSE,   -- 메인 추천 강좌 여부
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses: public read active" ON courses
  FOR SELECT USING (
    status = 'active' OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "courses: admin write" ON courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────
-- 4-4. sections & lessons (차시 구조)
-- ─────────────────────────────────────────
CREATE TABLE sections (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  sort_order  INT DEFAULT 0
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sections: public read" ON sections
  FOR SELECT USING (TRUE);

CREATE POLICY "sections: admin write" ON sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'instructor')
    )
  );

CREATE TABLE lessons (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id      UUID REFERENCES sections(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  video_url       TEXT,           -- Supabase Storage URL 또는 외부 URL
  duration        INT DEFAULT 0,  -- 초 단위
  sort_order      INT DEFAULT 0,
  is_preview      BOOLEAN DEFAULT FALSE  -- 비로그인 미리보기 허용 여부
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- enrollments 테이블 생성 후 아래에서 정책 추가 (순서 의존성)


-- ─────────────────────────────────────────
-- 4-5. enrollments (수강 신청)
-- ─────────────────────────────────────────
CREATE TABLE enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'active',  -- active|completed|expired|cancelled
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments: self read" ON enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "enrollments: self insert" ON enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "enrollments: admin read" ON enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- lessons RLS 정책 (enrollments 생성 후 추가)
CREATE POLICY "lessons: public read preview" ON lessons
  FOR SELECT USING (
    is_preview = TRUE OR
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE user_id = auth.uid() AND course_id = lessons.course_id AND status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'instructor')
    )
  );

CREATE POLICY "lessons: admin write" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'instructor')
    )
  );


-- ─────────────────────────────────────────
-- 4-6. lesson_progress (학습 진도)
-- ─────────────────────────────────────────
CREATE TABLE lesson_progress (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  watched_seconds INT DEFAULT 0,
  is_completed    BOOLEAN DEFAULT FALSE,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_progress: self" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- 4-7. certificates (수료증)
-- ─────────────────────────────────────────
CREATE TABLE certificates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id),
  course_id   UUID REFERENCES courses(id),
  cert_number TEXT NOT NULL UNIQUE,  -- CERT-YYYYMMDD-XXXXXX
  issued_at   TIMESTAMPTZ DEFAULT NOW(),
  pdf_url     TEXT
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificates: self read" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "certificates: admin read" ON certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );


-- ─────────────────────────────────────────
-- 4-8. 기타 테이블
-- ─────────────────────────────────────────

-- companies (B2B 협약기업)
CREATE TABLE companies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  contact_name    TEXT,
  contact_email   TEXT,
  contract_start  DATE,
  contract_end    DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies: admin only" ON companies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- company_members (기업-회원 연결)
CREATE TABLE company_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  department  TEXT,
  is_manager  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members: admin only" ON company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- banners (메인 배너)
CREATE TABLE banners (
  id          SERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  link_url    TEXT,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banners: public read" ON banners
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "banners: admin write" ON banners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- notices (공지사항)
CREATE TABLE notices (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT,
  is_pinned   BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices: public read" ON notices
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "notices: admin write" ON notices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- faqs
CREATE TABLE faqs (
  id          SERIAL PRIMARY KEY,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faqs: public read" ON faqs
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "faqs: admin write" ON faqs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- contacts (이용문의)
CREATE TABLE contacts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',  -- pending|answered
  answer      TEXT,
  answered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts: self read" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "contacts: self insert" ON contacts
  FOR INSERT WITH CHECK (TRUE);  -- 비로그인도 문의 가능 (user_id NULL)

CREATE POLICY "contacts: admin write" ON contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- wishlists (찜 목록)
CREATE TABLE wishlists (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlists: self" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- menus (GNB 메뉴)
CREATE TABLE menus (
  id          SERIAL PRIMARY KEY,
  parent_id   INT REFERENCES menus(id),
  label       TEXT NOT NULL,
  href        TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  target      TEXT DEFAULT '_self',  -- _self|_blank
  is_active   BOOLEAN DEFAULT TRUE,
  menu_type   TEXT DEFAULT 'home',   -- home|side
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menus: public read" ON menus
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "menus: admin write" ON menus
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- 초기 메뉴 데이터
INSERT INTO menus (label, href, sort_order, menu_type) VALUES
  ('강좌', '/courses', 1, 'home'),
  ('공지사항', '/notice', 2, 'home'),
  ('FAQ', '/faq', 3, 'home'),
  ('기업 도입', '/b2b', 4, 'home'),
  ('문의하기', '/contact', 5, 'home');

-- site_settings (사이트 설정 — KV 방식)
CREATE TABLE site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings: public read" ON site_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "site_settings: admin write" ON site_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- 초기 사이트 설정
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'Ingrow LMS'),
  ('site_description', 'AI·실무 역량 강화를 위한 이러닝 플랫폼'),
  ('main_color', '#2D7DD2'),
  ('logo_url', '');

-- access_logs (접속 로그 — 통계용)
CREATE TABLE access_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id),
  page_url    TEXT,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_logs: self insert" ON access_logs
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "access_logs: admin read" ON access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );
