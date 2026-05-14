-- Property documents: Supabase Storage metadata + private bucket `property-documents`.
-- Path convention: {user_id}/properties/{property_id}/{document_id}-{safe_filename}

-- ---------------------------------------------------------------------------
-- 1) Table columns (legacy rows keep file_path on disk; cloud rows use storage_*)
-- ---------------------------------------------------------------------------

ALTER TABLE public.property_documents
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

UPDATE public.property_documents
SET
  size_bytes = file_size
WHERE
  size_bytes IS NULL;

COMMENT ON COLUMN public.property_documents.storage_bucket IS 'Supabase Storage bucket id (e.g. property-documents); NULL for legacy Express disk rows.';

COMMENT ON COLUMN public.property_documents.storage_key IS 'Object path within the bucket; NULL for legacy disk rows.';

COMMENT ON COLUMN public.property_documents.original_filename IS 'Client-supplied filename at upload time (bounded); display may still use file_name.';

COMMENT ON COLUMN public.property_documents.size_bytes IS 'Byte size (mirrors file_size for new uploads); backfilled from file_size.';

ALTER TABLE public.property_documents
  DROP CONSTRAINT IF EXISTS property_documents_storage_key_owner_chk;

ALTER TABLE public.property_documents
  ADD CONSTRAINT property_documents_storage_key_owner_chk CHECK (
    storage_key IS NULL
    OR split_part(storage_key, '/', 1) = user_id::text
  );

-- ---------------------------------------------------------------------------
-- 2) Storage bucket (private)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES (
  'property-documents',
  'property-documents',
  false
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) storage.objects policies — path prefix must match auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS property_documents_storage_select_own ON storage.objects;

DROP POLICY IF EXISTS property_documents_storage_insert_own ON storage.objects;

DROP POLICY IF EXISTS property_documents_storage_update_own ON storage.objects;

DROP POLICY IF EXISTS property_documents_storage_delete_own ON storage.objects;

CREATE POLICY property_documents_storage_select_own ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'property-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY property_documents_storage_insert_own ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
  bucket_id = 'property-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY property_documents_storage_update_own ON storage.objects FOR
UPDATE TO authenticated USING (
  bucket_id = 'property-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
)
WITH CHECK (
  bucket_id = 'property-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY property_documents_storage_delete_own ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'property-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

COMMENT ON POLICY property_documents_storage_select_own ON storage.objects IS
  'Users read only objects under their auth.uid() prefix in property-documents.';

COMMENT ON POLICY property_documents_storage_insert_own ON storage.objects IS
  'Users upload only under their auth.uid() prefix.';

COMMENT ON POLICY property_documents_storage_delete_own ON storage.objects IS
  'Users delete only their own prefix.';
