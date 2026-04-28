-- ============================================================
-- Ingrow LMS — CMS Storage + Reorder 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Storage 버킷 생성 (배너 이미지용)
-- ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'banners: public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "banners: public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'banners')
    $policy$;
  END IF;
END $$;

-- 관리자만 업로드 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'banners: admin upload'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "banners: admin upload"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'banners' AND
        auth.role() = 'authenticated' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
        )
      )
    $policy$;
  END IF;
END $$;

-- 관리자 삭제 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'banners: admin delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "banners: admin delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'banners' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
        )
      )
    $policy$;
  END IF;
END $$;

-- ─────────────────────────────────────────
-- 2. home_sections 순서 일괄 변경 RPC
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reorder_home_sections(p_ids INT[])
RETURNS VOID AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE home_sections
    SET sort_order = i, updated_at = NOW()
    WHERE id = p_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- 3. menus 순서 일괄 변경 RPC
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reorder_menus(p_ids INT[])
RETURNS VOID AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE menus
    SET sort_order = i, updated_at = NOW()
    WHERE id = p_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
