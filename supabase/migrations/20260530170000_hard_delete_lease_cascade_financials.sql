-- hard_delete_lease: remove lease and all attached financial rows (not recoverable).
-- Use cancel_lease when history must be preserved.

CREATE OR REPLACE FUNCTION public.hard_delete_lease (p_lease_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease public.leases %ROWTYPE;
  v_inv int;
  v_inc int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    * INTO v_lease
  FROM
    public.leases l
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEASE_NOT_FOUND';
  END IF;

  UPDATE
    public.leases l
  SET
    lease_document_id = NULL,
    updated_at = now()
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid;

  DELETE FROM public.invoices i
  WHERE i.lease_id = p_lease_id
    AND i.user_id = v_uid;

  GET DIAGNOSTICS v_inv = ROW_COUNT;

  DELETE FROM public.income_entries e
  WHERE e.lease_id = p_lease_id
    AND e.user_id = v_uid;

  GET DIAGNOSTICS v_inc = ROW_COUNT;

  DELETE FROM public.recurring_invoice_rules r
  WHERE r.lease_id = p_lease_id
    AND r.user_id = v_uid;

  DELETE FROM public.recurring_income_rules r
  WHERE r.lease_id = p_lease_id
    AND r.user_id = v_uid;

  UPDATE public.tenant_unit_links t
  SET
    lease_id = NULL,
    updated_at = now()
  WHERE
    t.lease_id = p_lease_id
    AND t.user_id = v_uid;

  DELETE FROM public.leases l
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid;

  RETURN jsonb_build_object(
    'deleted',
    TRUE,
    'message',
    'Lease and attached records permanently deleted',
    'invoicesDeleted',
    v_inv,
    'incomeDeleted',
    v_inc
  );
END;
$$;

COMMENT ON FUNCTION public.hard_delete_lease (uuid) IS
  'Permanently deletes a lease and all linked invoices, income entries, and recurring rules. Use cancel_lease to keep lease history.';
