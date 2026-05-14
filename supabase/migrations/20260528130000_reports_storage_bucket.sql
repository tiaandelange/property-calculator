-- Generated calculation / property summary PDFs: Supabase Storage bucket `reports`.
-- Path convention: {user_id}/reports/{report_id}.pdf (matches public.stored_reports.id).

-- ---------------------------------------------------------------------------
-- 1) stored_reports — storage metadata (Express disk rows keep NULLs)
-- ---------------------------------------------------------------------------

ALTER TABLE public.stored_reports
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_key text;

COMMENT ON COLUMN public.stored_reports.storage_bucket IS 'Supabase Storage bucket id (e.g. reports); NULL for legacy Express disk rows.';

COMMENT ON COLUMN public.stored_reports.storage_key IS 'Object path within the bucket; NULL for legacy disk rows.';

ALTER TABLE public.stored_reports
  DROP CONSTRAINT IF EXISTS stored_reports_storage_key_owner_chk;

ALTER TABLE public.stored_reports
  ADD CONSTRAINT stored_reports_storage_key_owner_chk CHECK (
    storage_key IS NULL
    OR split_part(storage_key, '/', 1) = user_id::text
  );

-- ---------------------------------------------------------------------------
-- 2) Storage bucket (private)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES (
  'reports',
  'reports',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) storage.objects policies — {auth.uid()}/reports/...
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS reports_storage_select_own ON storage.objects;

DROP POLICY IF EXISTS reports_storage_insert_own ON storage.objects;

DROP POLICY IF EXISTS reports_storage_update_own ON storage.objects;

DROP POLICY IF EXISTS reports_storage_delete_own ON storage.objects;

CREATE POLICY reports_storage_select_own ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'reports'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'reports'
);

CREATE POLICY reports_storage_insert_own ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
  bucket_id = 'reports'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'reports'
);

CREATE POLICY reports_storage_update_own ON storage.objects FOR
UPDATE TO authenticated USING (
  bucket_id = 'reports'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'reports'
)
WITH CHECK (
  bucket_id = 'reports'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'reports'
);

CREATE POLICY reports_storage_delete_own ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'reports'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'reports'
);

-- No COMMENT ON POLICY on storage.objects (see property_documents migration; SQLSTATE 42501 on hosted).
