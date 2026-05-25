-- Invoice PDFs: Supabase Storage bucket `invoices` + metadata columns on public.invoices.
-- Path convention: {user_id}/invoices/{invoice_id}.pdf

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pdf_storage_bucket text,
  ADD COLUMN IF NOT EXISTS pdf_storage_key text;

COMMENT ON COLUMN public.invoices.pdf_storage_bucket IS 'Supabase Storage bucket id (e.g. invoices); NULL until PDF generated on Vercel.';

COMMENT ON COLUMN public.invoices.pdf_storage_key IS 'Object path within the bucket; NULL until PDF generated. Legacy Express rows may use pdf_path on disk instead.';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_pdf_storage_key_owner_chk;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_pdf_storage_key_owner_chk CHECK (
    pdf_storage_key IS NULL
    OR split_part(pdf_storage_key, '/', 1) = user_id::text
  );

INSERT INTO storage.buckets (id, name, public)
VALUES (
  'invoices',
  'invoices',
  false
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS invoices_storage_select_own ON storage.objects;

DROP POLICY IF EXISTS invoices_storage_insert_own ON storage.objects;

DROP POLICY IF EXISTS invoices_storage_update_own ON storage.objects;

DROP POLICY IF EXISTS invoices_storage_delete_own ON storage.objects;

CREATE POLICY invoices_storage_select_own ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'invoices'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'invoices'
);

CREATE POLICY invoices_storage_insert_own ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
  bucket_id = 'invoices'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'invoices'
);

CREATE POLICY invoices_storage_update_own ON storage.objects FOR
UPDATE TO authenticated USING (
  bucket_id = 'invoices'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'invoices'
)
WITH CHECK (
  bucket_id = 'invoices'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'invoices'
);

CREATE POLICY invoices_storage_delete_own ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'invoices'
  AND split_part(name, '/', 1) = auth.uid ()::text
  AND split_part(name, '/', 2) = 'invoices'
);
