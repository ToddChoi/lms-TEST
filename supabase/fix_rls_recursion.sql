-- ============================================================
-- RLS 무한 재귀 수정 마이그레이션
-- 원인: profiles 정책이 자기 자신을 subquery로 참조 → 무한 루프
-- 해결: SECURITY DEFINER 함수로 role 조회 (RLS 우회)
-- ============================================================

-- 1. role 조회용 SECURITY DEFINER 함수 생성
--    이 함수는 RLS를 우회(함수 소유자 권한으로 실행)하므로 재귀 없음
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- 2. profiles 정책 수정
DROP POLICY IF EXISTS "profiles: admin read" ON profiles;
CREATE POLICY "profiles: admin read" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR get_my_role() IN ('admin', 'superadmin')
  );

-- 3. courses 정책 수정
DROP POLICY IF EXISTS "courses: public read active" ON courses;
CREATE POLICY "courses: public read active" ON courses
  FOR SELECT USING (
    status = 'active'
    OR get_my_role() IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS "courses: admin write" ON courses;
CREATE POLICY "courses: admin write" ON courses
  FOR ALL USING (
    get_my_role() IN ('admin', 'superadmin')
  );

-- 4. sections 정책 수정
DROP POLICY IF EXISTS "sections: admin write" ON sections;
CREATE POLICY "sections: admin write" ON sections
  FOR ALL USING (
    get_my_role() IN ('admin', 'superadmin', 'instructor')
  );

-- 5. lessons 정책 수정
DROP POLICY IF EXISTS "lessons: public read preview" ON lessons;
CREATE POLICY "lessons: public read preview" ON lessons
  FOR SELECT USING (
    is_preview = TRUE
    OR EXISTS (
      SELECT 1 FROM enrollments
      WHERE user_id = auth.uid()
        AND course_id = lessons.course_id
        AND status = 'active'
    )
    OR get_my_role() IN ('admin', 'superadmin', 'instructor')
  );

DROP POLICY IF EXISTS "lessons: admin write" ON lessons;
CREATE POLICY "lessons: admin write" ON lessons
  FOR ALL USING (
    get_my_role() IN ('admin', 'superadmin', 'instructor')
  );

-- 6. enrollments 정책 수정
DROP POLICY IF EXISTS "enrollments: admin read" ON enrollments;
CREATE POLICY "enrollments: admin read" ON enrollments
  FOR SELECT USING (
    get_my_role() IN ('admin', 'superadmin')
  );

-- 7. certificates 정책 수정
DROP POLICY IF EXISTS "certificates: admin read" ON certificates;
CREATE POLICY "certificates: admin read" ON certificates
  FOR SELECT USING (
    get_my_role() IN ('admin', 'superadmin')
  );

-- 8. companies 정책 수정
DROP POLICY IF EXISTS "companies: admin only" ON companies;
CREATE POLICY "companies: admin only" ON companies
  FOR ALL USING (
    get_my_role() IN ('admin', 'superadmin')
  );

-- 9. company_members 정책 수정
DROP POLICY IF EXISTS "company_members: admin only" ON company_members;
CREATE POLICY "company_members: admin only" ON company_members
  FOR ALL USING (
    get_my_role() IN ('admin', 'superadmin')
    OR (
      is_manager = TRUE
      AND user_id = auth.uid()
    )
  );

-- 10. 나머지 테이블 정책 수정
DROP POLICY IF EXISTS "banners: admin write" ON banners;
CREATE POLICY "banners: admin write" ON banners
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "notices: admin write" ON notices;
CREATE POLICY "notices: admin write" ON notices
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "faqs: admin write" ON faqs;
CREATE POLICY "faqs: admin write" ON faqs
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "contacts: admin write" ON contacts;
CREATE POLICY "contacts: admin write" ON contacts
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "menus: admin write" ON menus;
CREATE POLICY "menus: admin write" ON menus
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "site_settings: admin write" ON site_settings;
CREATE POLICY "site_settings: admin write" ON site_settings
  FOR ALL USING ( get_my_role() IN ('admin', 'superadmin') );

DROP POLICY IF EXISTS "access_logs: admin read" ON access_logs;
CREATE POLICY "access_logs: admin read" ON access_logs
  FOR SELECT USING ( get_my_role() IN ('admin', 'superadmin') );
