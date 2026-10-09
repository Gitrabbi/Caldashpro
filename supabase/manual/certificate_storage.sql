-- Run in Supabase SQL Editor as a project administrator.
-- Private bucket for calibration certificates; max 10MB; PDFs only.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('calibration-certificates','calibration-certificates',false,10485760,ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['application/pdf'];

DROP POLICY IF EXISTS "calcert_select" ON storage.objects;
CREATE POLICY "calcert_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='calibration-certificates' AND EXISTS
 (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active=true));

DROP POLICY IF EXISTS "calcert_insert" ON storage.objects;
CREATE POLICY "calcert_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='calibration-certificates' AND EXISTS
 (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active=true AND p.role IN ('admin','manager')));

DROP POLICY IF EXISTS "calcert_update" ON storage.objects;
CREATE POLICY "calcert_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='calibration-certificates' AND EXISTS
 (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active=true AND p.role IN ('admin','manager')))
WITH CHECK (bucket_id='calibration-certificates' AND EXISTS
 (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active=true AND p.role IN ('admin','manager')));

DROP POLICY IF EXISTS "calcert_delete" ON storage.objects;
CREATE POLICY "calcert_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='calibration-certificates' AND EXISTS
 (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.active=true AND p.role IN ('admin','manager')));
