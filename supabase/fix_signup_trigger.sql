-- 회원가입 트리거 수정
-- SECURITY DEFINER 함수도 RLS에 걸릴 수 있으므로
-- profiles INSERT 정책을 service_role 우회 허용으로 변경

-- 1. 기존 INSERT 정책 삭제
DROP POLICY IF EXISTS "profiles: insert own" ON profiles;

-- 2. 트리거용 INSERT 정책 재생성 (service_role bypass 허용)
CREATE POLICY "profiles: insert own" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id          -- 본인 가입
    OR auth.uid() IS NULL    -- 트리거(service_role) 실행 허용
  );

-- 3. 트리거 함수 재생성 (search_path 명시로 안정성 강화)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;  -- 중복 방지
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. 트리거 재등록
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
