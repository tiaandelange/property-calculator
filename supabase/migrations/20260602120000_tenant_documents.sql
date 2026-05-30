-- Tenant documents: applicant uploads (ID, payslips, bank statements) stored per tenant.
-- Storage bucket: tenant-documents
-- Path (owner): {user_id}/tenants/{tenant_id}/{document_id}-{safe_filename}
-- Path (applicant upload grant): same key registered on grant row before upload

-- ---------------------------------------------------------------------------
-- 1) Document slots + table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  document_slot text NOT NULL,
  file_name text NOT NULL DEFAULT 'document',
  mime_type text,
  size_bytes bigint,
  storage_bucket text NOT NULL DEFAULT 'tenant-documents',
  storage_key text NOT NULL,
  original_filename text,
  source text NOT NULL DEFAULT 'applicant' CHECK (source IN ('applicant', 'owner')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_documents_slot_chk CHECK (
    document_slot IN (
      'ID',
      'PAYSLIP_1',
      'PAYSLIP_2',
      'PAYSLIP_3',
      'BANK_STATEMENT_1',
      'BANK_STATEMENT_2',
      'BANK_STATEMENT_3'
    )
  ),
  CONSTRAINT tenant_documents_storage_key_owner_chk CHECK (
    split_part(storage_key, '/', 1) = user_id::text
  ),
  CONSTRAINT tenant_documents_tenant_slot_uniq UNIQUE (tenant_id, document_slot)
);

CREATE INDEX IF NOT EXISTS tenant_documents_tenant_id_idx ON public.tenant_documents (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_documents_user_id_idx ON public.tenant_documents (user_id);

COMMENT ON TABLE public.tenant_documents IS 'Per-tenant uploaded files (applicant vetting docs persist after promotion to ACTIVE tenant).';

-- Short-lived grants so anonymous applicants can upload via Storage RLS
CREATE TABLE IF NOT EXISTS public.applicant_document_upload_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.tenant_documents (id) ON DELETE CASCADE,
  document_slot text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_document_upload_grants_token_idx ON public.applicant_document_upload_grants (upload_token);

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.applicant_document_upload_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_documents_select_own ON public.tenant_documents;

CREATE POLICY tenant_documents_select_own ON public.tenant_documents FOR
SELECT TO authenticated USING (user_id = auth.uid ());

DROP POLICY IF EXISTS tenant_documents_insert_own ON public.tenant_documents;

CREATE POLICY tenant_documents_insert_own ON public.tenant_documents FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS tenant_documents_update_own ON public.tenant_documents;

CREATE POLICY tenant_documents_update_own ON public.tenant_documents FOR
UPDATE TO authenticated USING (user_id = auth.uid ())
WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS tenant_documents_delete_own ON public.tenant_documents;

CREATE POLICY tenant_documents_delete_own ON public.tenant_documents FOR
DELETE TO authenticated USING (user_id = auth.uid ());

-- Grants table: no direct client access (RPC only)
DROP POLICY IF EXISTS applicant_document_upload_grants_deny_all ON public.applicant_document_upload_grants;

CREATE POLICY applicant_document_upload_grants_deny_all ON public.applicant_document_upload_grants FOR ALL TO authenticated, anon USING (FALSE);

-- ---------------------------------------------------------------------------
-- 3) Storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES (
  'tenant-documents',
  'tenant-documents',
  false
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS tenant_documents_storage_select_own ON storage.objects;

DROP POLICY IF EXISTS tenant_documents_storage_insert_own ON storage.objects;

DROP POLICY IF EXISTS tenant_documents_storage_update_own ON storage.objects;

DROP POLICY IF EXISTS tenant_documents_storage_delete_own ON storage.objects;

DROP POLICY IF EXISTS tenant_documents_storage_applicant_insert ON storage.objects;

CREATE POLICY tenant_documents_storage_select_own ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'tenant-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY tenant_documents_storage_insert_own ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
  bucket_id = 'tenant-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY tenant_documents_storage_update_own ON storage.objects FOR
UPDATE TO authenticated USING (
  bucket_id = 'tenant-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
)
WITH CHECK (
  bucket_id = 'tenant-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

CREATE POLICY tenant_documents_storage_delete_own ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'tenant-documents'
  AND split_part(name, '/', 1) = auth.uid ()::text
);

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

-- ---------------------------------------------------------------------------
-- 4) Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sanitize_tenant_document_filename (p_name text, p_max_len int DEFAULT 180)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    CASE WHEN length(cleaned) > p_max_len THEN
      substring(cleaned FROM 1 FOR p_max_len)
    ELSE
      cleaned
    END
  FROM (
    SELECT
      coalesce(nullif(regexp_replace(coalesce(p_name, 'document'), '[^\w.\- ()\[\]]', '_', 'g'), ''), 'document') AS cleaned) s;
$$;

CREATE OR REPLACE FUNCTION public.build_tenant_document_storage_key (
  p_user_id uuid,
  p_tenant_id uuid,
  p_document_id uuid,
  p_filename text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    p_user_id::text || '/tenants/' || p_tenant_id::text || '/' || p_document_id::text || '-' || public.sanitize_tenant_document_filename (p_filename);
$$;

CREATE OR REPLACE FUNCTION public.validate_applicant_document_slot (p_slot text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    p_slot IN (
      'ID',
      'PAYSLIP_1',
      'PAYSLIP_2',
      'PAYSLIP_3',
      'BANK_STATEMENT_1',
      'BANK_STATEMENT_2',
      'BANK_STATEMENT_3'
    );
$$;

CREATE OR REPLACE FUNCTION public.assert_applicant_invite_tenant (p_token text, p_tenant_id uuid)
  RETURNS TABLE (
    owner_user_id uuid,
    invite_id uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.applicant_invites %ROWTYPE;
BEGIN
  SELECT
    * INTO v_inv
  FROM
    public.applicant_invites i
  WHERE
    i.token = p_token
    AND i.revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.tenants t
    WHERE
      t.id = p_tenant_id
      AND t.user_id = v_inv.user_id
      AND t.status = 'APPLICANT'
      AND t.applied_property_id = v_inv.property_id) THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  owner_user_id := v_inv.user_id;
  invite_id := v_inv.id;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs
-- ---------------------------------------------------------------------------

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
      jsonb_agg(jsonb_build_object(
          'id', d.id,
          'documentSlot', d.document_slot,
          'fileName', d.file_name,
          'mimeType', d.mime_type,
          'sizeBytes', d.size_bytes,
          'storageBucket', d.storage_bucket,
          'storageKey', d.storage_key,
          'originalFilename', d.original_filename,
          'source', d.source,
          'uploadedAt', d.uploaded_at
        )
        ORDER BY d.document_slot)
    FROM
      public.tenant_documents d
    WHERE
      d.tenant_id = p_tenant_id
      AND d.user_id = v_uid), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_documents_owner (uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_applicant_documents_public (p_token text, p_tenant_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  PERFORM
    1
  FROM
    public.assert_applicant_invite_tenant (p_token, p_tenant_id);

  RETURN coalesce((
    SELECT
      jsonb_agg(jsonb_build_object(
          'id', d.id,
          'documentSlot', d.document_slot,
          'fileName', d.file_name,
          'mimeType', d.mime_type,
          'sizeBytes', d.size_bytes,
          'originalFilename', d.original_filename,
          'uploadedAt', d.uploaded_at
        )
        ORDER BY d.document_slot)
    FROM
      public.tenant_documents d
    WHERE
      d.tenant_id = p_tenant_id), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_applicant_documents_public (text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_applicant_document_upload (
  p_token text,
  p_tenant_id uuid,
  p_slot text,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_owner uuid;
  v_document_id uuid;
  v_key text;
  v_upload_token uuid;
  v_safe_name text;
  v_old_key text;
BEGIN
  IF NOT public.validate_applicant_document_slot (p_slot) THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_SLOT';
  END IF;

  IF coalesce(p_size_bytes, 0) <= 0 OR p_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'INVALID_FILE_SIZE';
  END IF;

  SELECT
    owner_user_id INTO v_owner
  FROM
    public.assert_applicant_invite_tenant (p_token, p_tenant_id);

  v_safe_name := public.sanitize_tenant_document_filename (coalesce(p_filename, 'document'), 200);

  SELECT
    d.id,
    d.storage_key INTO v_document_id,
    v_old_key
  FROM
    public.tenant_documents d
  WHERE
    d.tenant_id = p_tenant_id
    AND d.document_slot = p_slot;

  IF v_document_id IS NULL THEN
    v_document_id := gen_random_uuid();
    v_key := public.build_tenant_document_storage_key (v_owner, p_tenant_id, v_document_id, v_safe_name);
    INSERT INTO public.tenant_documents (
      id,
      user_id,
      tenant_id,
      document_slot,
      file_name,
      mime_type,
      size_bytes,
      storage_bucket,
      storage_key,
      original_filename,
      source)
    VALUES (
      v_document_id,
      v_owner,
      p_tenant_id,
      p_slot,
      v_safe_name,
      nullif(trim(p_mime_type), ''),
      p_size_bytes,
      'tenant-documents',
      v_key,
      left(coalesce(p_filename, 'document'), 255),
      'applicant');
  ELSE
    v_key := public.build_tenant_document_storage_key (v_owner, p_tenant_id, v_document_id, v_safe_name);
    UPDATE
      public.tenant_documents
    SET
      file_name = v_safe_name,
      mime_type = nullif(trim(p_mime_type), ''),
      size_bytes = p_size_bytes,
      storage_key = v_key,
      original_filename = left(coalesce(p_filename, 'document'), 255),
      updated_at = now()
    WHERE
      id = v_document_id;
    IF v_old_key IS NOT NULL AND v_old_key <> v_key THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'tenant-documents'
        AND name = v_old_key;
    END IF;
  END IF;

  DELETE FROM public.applicant_document_upload_grants
  WHERE document_id = v_document_id
    AND used_at IS NULL;

  INSERT INTO public.applicant_document_upload_grants (
    user_id,
    tenant_id,
    document_id,
    document_slot,
    storage_key,
    expires_at)
  VALUES (
    v_owner,
    p_tenant_id,
    v_document_id,
    p_slot,
    v_key,
    now() + interval '1 hour')
  RETURNING
    upload_token INTO v_upload_token;

  RETURN jsonb_build_object(
    'documentId', v_document_id,
    'uploadToken', v_upload_token,
    'storageBucket', 'tenant-documents',
    'storageKey', v_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_applicant_document_upload (text, uuid, text, text, text, bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_applicant_document_upload (
  p_token text,
  p_tenant_id uuid,
  p_document_id uuid,
  p_upload_token uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_grant public.applicant_document_upload_grants %ROWTYPE;
  v_doc public.tenant_documents %ROWTYPE;
BEGIN
  PERFORM
    1
  FROM
    public.assert_applicant_invite_tenant (p_token, p_tenant_id);

  SELECT
    * INTO v_grant
  FROM
    public.applicant_document_upload_grants g
  WHERE
    g.upload_token = p_upload_token
    AND g.document_id = p_document_id
    AND g.tenant_id = p_tenant_id
    AND g.used_at IS NULL
    AND g.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UPLOAD_GRANT_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      storage.objects o
    WHERE
      o.bucket_id = 'tenant-documents'
      AND o.name = v_grant.storage_key) THEN
    RAISE EXCEPTION 'STORAGE_OBJECT_MISSING';
  END IF;

  UPDATE
    public.applicant_document_upload_grants
  SET
    used_at = now()
  WHERE
    id = v_grant.id;

  UPDATE
    public.tenant_documents
  SET
    uploaded_at = now(),
    updated_at = now()
  WHERE
    id = p_document_id
  RETURNING
    * INTO v_doc;

  RETURN jsonb_build_object(
    'id', v_doc.id,
    'documentSlot', v_doc.document_slot,
    'fileName', v_doc.file_name,
    'mimeType', v_doc.mime_type,
    'sizeBytes', v_doc.size_bytes,
    'originalFilename', v_doc.original_filename,
    'uploadedAt', v_doc.uploaded_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_applicant_document_upload (text, uuid, uuid, uuid) TO anon, authenticated;
