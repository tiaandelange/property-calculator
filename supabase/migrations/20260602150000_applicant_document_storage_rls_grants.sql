-- Fix anonymous applicant storage uploads: storage RLS subqueries need table SELECT grants.

GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON TABLE public.applicant_document_upload_grants TO anon, authenticated;

-- Re-assert storage policies for applicant uploads (INSERT + UPDATE via active grant).
DROP POLICY IF EXISTS tenant_documents_storage_applicant_insert ON storage.objects;

DROP POLICY IF EXISTS tenant_documents_storage_applicant_update ON storage.objects;

CREATE POLICY tenant_documents_storage_applicant_insert ON storage.objects FOR
INSERT TO anon, authenticated WITH CHECK (
  bucket_id = 'tenant-documents'
  AND EXISTS (
    SELECT
      1
    FROM
      public.applicant_document_upload_grants g
    WHERE
      g.storage_key = name
      AND g.used_at IS NULL
      AND g.expires_at > now()
  )
);

CREATE POLICY tenant_documents_storage_applicant_update ON storage.objects FOR
UPDATE TO anon, authenticated USING (
  bucket_id = 'tenant-documents'
  AND EXISTS (
    SELECT
      1
    FROM
      public.applicant_document_upload_grants g
    WHERE
      g.storage_key = name
      AND g.used_at IS NULL
      AND g.expires_at > now()
  )
)
WITH CHECK (
  bucket_id = 'tenant-documents'
  AND EXISTS (
    SELECT
      1
    FROM
      public.applicant_document_upload_grants g
    WHERE
      g.storage_key = name
      AND g.used_at IS NULL
      AND g.expires_at > now()
  )
);

-- Applicant document rows are written only via SECURITY DEFINER RPCs, never by anon clients directly.
DROP POLICY IF EXISTS tenant_documents_select_applicant_grant ON public.tenant_documents;

DROP POLICY IF EXISTS tenant_documents_insert_applicant_grant ON public.tenant_documents;

DROP POLICY IF EXISTS tenant_documents_update_applicant_grant ON public.tenant_documents;
