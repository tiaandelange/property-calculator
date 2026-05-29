-- Tenant application fields (not property link) + permanent lease deletion.
-- Apply with: supabase db push

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS applied_property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_unit_id uuid REFERENCES public.property_units (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenants_applied_property_id_idx ON public.tenants (applied_property_id);
CREATE INDEX IF NOT EXISTS tenants_applied_unit_id_idx ON public.tenants (applied_unit_id);

COMMENT ON COLUMN public.tenants.applied_property_id IS
  'Property the tenant applied for — does not link the tenant to the property (use tenant_unit_links / property_id for that).';

COMMENT ON COLUMN public.tenants.applied_unit_id IS
  'Preferred unit within applied_property_id when the property has multiple units.';

-- ---------------------------------------------------------------------------
-- hard_delete_lease: permanent removal (not recoverable). Use cancel_lease to keep history.
-- ---------------------------------------------------------------------------
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

  SELECT
    COUNT(*) INTO v_inv
  FROM
    public.invoices i
  WHERE
    i.lease_id = p_lease_id
    AND i.user_id = v_uid;

  SELECT
    COUNT(*) INTO v_inc
  FROM
    public.income_entries e
  WHERE
    e.lease_id = p_lease_id
    AND e.user_id = v_uid;

  IF v_inv > 0 OR v_inc > 0 THEN
    RAISE EXCEPTION 'LEASE_HAS_FINANCIALS';
  END IF;

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

  RETURN jsonb_build_object('deleted', TRUE, 'message', 'Lease permanently deleted');
END;
$$;

COMMENT ON FUNCTION public.hard_delete_lease (uuid) IS
  'Permanently deletes a lease with no invoices or income entries. Use cancel_lease to retain lease history and financials.';

GRANT EXECUTE ON FUNCTION public.hard_delete_lease (uuid) TO authenticated;
