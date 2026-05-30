-- Fix anonymous applicant storage uploads: storage RLS subqueries must read active upload grants.

DROP POLICY IF EXISTS applicant_document_upload_grants_deny_all ON public.applicant_document_upload_grants;

DROP POLICY IF EXISTS applicant_document_upload_grants_no_client_insert ON public.applicant_document_upload_grants;

DROP POLICY IF EXISTS applicant_document_upload_grants_no_client_update ON public.applicant_document_upload_grants;

DROP POLICY IF EXISTS applicant_document_upload_grants_no_client_delete ON public.applicant_document_upload_grants;

DROP POLICY IF EXISTS applicant_document_upload_grants_select_active ON public.applicant_document_upload_grants;

-- Block direct client writes; grants are created only via SECURITY DEFINER RPCs.
CREATE POLICY applicant_document_upload_grants_no_client_insert ON public.applicant_document_upload_grants FOR
INSERT TO anon, authenticated WITH CHECK (FALSE);

CREATE POLICY applicant_document_upload_grants_no_client_update ON public.applicant_document_upload_grants FOR
UPDATE TO anon, authenticated USING (FALSE);

CREATE POLICY applicant_document_upload_grants_no_client_delete ON public.applicant_document_upload_grants FOR
DELETE TO anon, authenticated USING (FALSE);

-- Required so storage.objects INSERT/UPDATE policies can match active grants.
CREATE POLICY applicant_document_upload_grants_select_active ON public.applicant_document_upload_grants FOR
SELECT TO anon, authenticated USING (
  used_at IS NULL
  AND expires_at > now()
);
