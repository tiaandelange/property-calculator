-- Idempotent: signed lease uploads require tenant_documents.lease_id (see 20260604140000).
-- Safe to run if that migration was skipped or only partially applied.

ALTER TABLE public.tenant_documents
  ADD COLUMN IF NOT EXISTS lease_id uuid REFERENCES public.leases (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tenant_documents_lease_id_idx ON public.tenant_documents (lease_id)
WHERE
  lease_id IS NOT NULL;

ALTER TABLE public.tenant_documents
  DROP CONSTRAINT IF EXISTS tenant_documents_slot_chk;

ALTER TABLE public.tenant_documents
  ADD CONSTRAINT tenant_documents_slot_chk CHECK (
    document_slot IN (
      'ID',
      'PAYSLIP_1',
      'PAYSLIP_2',
      'PAYSLIP_3',
      'BANK_STATEMENT_1',
      'BANK_STATEMENT_2',
      'BANK_STATEMENT_3',
      'LEASE_CONTRACT'
    )
  );

ALTER TABLE public.tenant_documents
  DROP CONSTRAINT IF EXISTS tenant_documents_tenant_slot_uniq;

DROP INDEX IF EXISTS public.tenant_documents_tenant_slot_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_documents_tenant_slot_uniq ON public.tenant_documents (tenant_id, document_slot)
WHERE
  lease_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_documents_lease_contract_uniq ON public.tenant_documents (lease_id)
WHERE
  lease_id IS NOT NULL
  AND document_slot = 'LEASE_CONTRACT';

ALTER TABLE public.tenant_documents
  DROP CONSTRAINT IF EXISTS tenant_documents_source_chk;

ALTER TABLE public.tenant_documents
  DROP CONSTRAINT IF EXISTS tenant_documents_source_check;

ALTER TABLE public.tenant_documents
  ADD CONSTRAINT tenant_documents_source_chk CHECK (source IN ('applicant', 'owner', 'lease'));

COMMENT ON COLUMN public.tenant_documents.lease_id IS 'When set with LEASE_CONTRACT, file is the signed lease for this lease (shown on all tenants on the lease).';

CREATE OR REPLACE FUNCTION public.list_tenant_documents_owner (p_tenant_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.tenants t
    WHERE
      t.id = p_tenant_id
      AND t.user_id = v_uid) THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  RETURN coalesce((
    SELECT
      jsonb_agg(row_data ORDER BY sort_slot)
    FROM (
      SELECT
        jsonb_build_object(
          'id', d.id,
          'documentSlot', d.document_slot,
          'fileName', d.file_name,
          'mimeType', d.mime_type,
          'sizeBytes', d.size_bytes,
          'storageBucket', d.storage_bucket,
          'storageKey', d.storage_key,
          'originalFilename', d.original_filename,
          'source', d.source,
          'uploadedAt', d.uploaded_at,
          'leaseId', d.lease_id
        ) AS row_data,
        d.document_slot AS sort_slot
      FROM
        public.tenant_documents d
      WHERE
        d.user_id = v_uid
        AND d.tenant_id = p_tenant_id
        AND d.lease_id IS NULL
      UNION ALL
      SELECT
        jsonb_build_object(
          'id', d.id,
          'documentSlot', d.document_slot,
          'fileName', d.file_name,
          'mimeType', d.mime_type,
          'sizeBytes', d.size_bytes,
          'storageBucket', d.storage_bucket,
          'storageKey', d.storage_key,
          'originalFilename', d.original_filename,
          'source', d.source,
          'uploadedAt', d.uploaded_at,
          'leaseId', d.lease_id
        ) AS row_data,
        d.document_slot AS sort_slot
      FROM
        public.tenant_documents d
      WHERE
        d.user_id = v_uid
        AND d.document_slot = 'LEASE_CONTRACT'
        AND d.lease_id IS NOT NULL
        AND EXISTS (
          SELECT
            1
          FROM
            public.lease_tenants lt
          WHERE
            lt.lease_id = d.lease_id
            AND lt.tenant_id = p_tenant_id)) AS combined), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_documents_owner (uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
