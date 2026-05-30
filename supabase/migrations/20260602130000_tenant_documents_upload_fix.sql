-- Allow anonymous applicants to replace a document at the same storage key (upsert UPDATE).

DROP POLICY IF EXISTS tenant_documents_storage_applicant_update ON storage.objects;

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

-- When replacing a file, remove the previous object so INSERT works even without UPDATE.
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
    IF v_old_key IS NOT NULL THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'tenant-documents'
        AND name = v_old_key;
    END IF;
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
