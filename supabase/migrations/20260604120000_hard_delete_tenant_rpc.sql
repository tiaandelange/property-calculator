-- Permanently delete a tenant and all owned financial / link rows.
-- Primary leases are removed via hard_delete_lease; co-tenant links are unlinked only.

CREATE OR REPLACE FUNCTION public.hard_delete_tenant (p_tenant_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease_id uuid;
  v_leases_deleted int := 0;
  v_inv_deleted int := 0;
  v_income_deleted int := 0;
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
      AND t.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  FOR v_lease_id IN
    SELECT
      l.id
    FROM
      public.leases l
    WHERE
      l.tenant_id = p_tenant_id
      AND l.user_id = v_uid
  LOOP
    PERFORM public.hard_delete_lease (v_lease_id);
    v_leases_deleted := v_leases_deleted + 1;
  END LOOP;

  DELETE FROM public.lease_tenants lt
  WHERE
    lt.tenant_id = p_tenant_id
    AND lt.user_id = v_uid;

  DELETE FROM public.invoices i
  WHERE
    i.tenant_id = p_tenant_id
    AND i.user_id = v_uid;

  GET DIAGNOSTICS v_inv_deleted = ROW_COUNT;

  DELETE FROM public.income_entries e
  WHERE
    e.tenant_id = p_tenant_id
    AND e.user_id = v_uid;

  GET DIAGNOSTICS v_income_deleted = ROW_COUNT;

  DELETE FROM public.recurring_invoice_rules r
  WHERE
    r.tenant_id = p_tenant_id
    AND r.user_id = v_uid;

  DELETE FROM public.recurring_income_rules r
  WHERE
    r.tenant_id = p_tenant_id
    AND r.user_id = v_uid;

  DELETE FROM public.tenant_unit_links tul
  WHERE
    tul.tenant_id = p_tenant_id
    AND tul.user_id = v_uid;

  DELETE FROM public.tenants t
  WHERE
    t.id = p_tenant_id
    AND t.user_id = v_uid;

  RETURN jsonb_build_object(
    'message',
    'Tenant permanently deleted',
    'leasesDeleted',
    v_leases_deleted,
    'invoicesDeleted',
    v_inv_deleted,
    'incomeDeleted',
    v_income_deleted
  );
END;
$$;

COMMENT ON FUNCTION public.hard_delete_tenant (uuid) IS
  'Permanently deletes tenant, primary leases (via hard_delete_lease), co-tenant links, invoices, income, and rules. tenant_documents/applicant rows cascade on tenant delete.';

GRANT EXECUTE ON FUNCTION public.hard_delete_tenant (uuid) TO authenticated;
