-- Atomic lease lifecycle helpers (SECURITY INVOKER: RLS applies; ownership enforced explicitly).
-- Used by the SPA via Supabase RPC when Express lease routes are bypassed.

-- ---------------------------------------------------------------------------
-- create_property_lease: tenant link + lease insert + optional rent rule (Express parity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_property_lease (p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_property_id uuid := (p_payload ->> 'propertyId')::uuid;
  v_tenant_id uuid := (p_payload ->> 'tenantId')::uuid;
  v_lease_type public.app_lease_type := coalesce((p_payload ->> 'leaseType')::public.app_lease_type, 'FIXED_TERM'::public.app_lease_type);
  v_start timestamptz := (p_payload ->> 'startDate')::timestamptz;
  v_fixed_end timestamptz;
  v_monthly double precision := coalesce((p_payload ->> 'monthlyRent')::double precision, -1);
  v_deposit double precision := coalesce((p_payload ->> 'depositAmount')::double precision, -1);
  v_rent_due integer := coalesce((p_payload ->> 'rentDueDay')::integer, 1);
  v_esc_pct double precision;
  v_esc_date timestamptz;
  v_notes text := p_payload ->> 'notes';
  v_lease_doc uuid;
  v_create_rule boolean := coalesce((p_payload ->> 'createExpectedRentRule')::boolean, TRUE);
  v_lease_status public.app_lease_status;
  v_lease_id uuid;
  v_row public.leases %ROWTYPE;
  v_active int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF v_property_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PROPERTY_OR_TENANT';
  END IF;
  IF v_monthly < 0 OR v_deposit < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_AMOUNT';
  END IF;
  IF v_rent_due < 1 OR v_rent_due > 31 THEN
    RAISE EXCEPTION 'INVALID_RENT_DUE_DAY';
  END IF;
  PERFORM
    1
  FROM
    public.properties p
  WHERE
    p.id = v_property_id
    AND p.user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;
  PERFORM
    1
  FROM
    public.tenants t
  WHERE
    t.id = v_tenant_id
    AND t.user_id = v_uid
    AND (t.property_id IS NULL
      OR t.property_id = v_property_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TENANT';
  END IF;
  SELECT
    COUNT(*) INTO v_active
  FROM
    public.leases l
  WHERE
    l.user_id = v_uid
    AND l.tenant_id = v_tenant_id
    AND l.status IN ('ACTIVE', 'MONTH_TO_MONTH')
    AND l.cancellation_date IS NULL;
  IF v_active > 0 THEN
    RAISE EXCEPTION 'TENANT_HAS_ACTIVE_LEASE';
  END IF;
  IF p_payload ? 'fixedTermEndDate' AND p_payload ->> 'fixedTermEndDate' IS NOT NULL AND length(trim(p_payload ->> 'fixedTermEndDate')) > 0 THEN
    v_fixed_end := (p_payload ->> 'fixedTermEndDate')::timestamptz;
  ELSIF p_payload ? 'endDate' AND p_payload ->> 'endDate' IS NOT NULL AND length(trim(p_payload ->> 'endDate')) > 0 THEN
    v_fixed_end := (p_payload ->> 'endDate')::timestamptz;
  ELSE
    v_fixed_end := NULL;
  END IF;
  IF v_lease_type = 'FIXED_TERM'::public.app_lease_type THEN
    IF v_fixed_end IS NULL THEN
      RAISE EXCEPTION 'FIXED_TERM_END_REQUIRED';
    END IF;
    IF v_fixed_end <= v_start THEN
      RAISE EXCEPTION 'FIXED_TERM_END_AFTER_START';
    END IF;
  END IF;
  IF p_payload ? 'leaseDocumentId' AND p_payload ->> 'leaseDocumentId' IS NOT NULL AND length(trim(p_payload ->> 'leaseDocumentId')) > 0 THEN
    v_lease_doc := (p_payload ->> 'leaseDocumentId')::uuid;
  ELSE
    v_lease_doc := NULL;
  END IF;
  IF p_payload ? 'escalationPercent' AND p_payload ->> 'escalationPercent' IS NOT NULL AND length(trim(p_payload ->> 'escalationPercent')) > 0 THEN
    v_esc_pct := (p_payload ->> 'escalationPercent')::double precision;
  ELSE
    v_esc_pct := NULL;
  END IF;
  IF p_payload ? 'escalationDate' AND p_payload ->> 'escalationDate' IS NOT NULL AND length(trim(p_payload ->> 'escalationDate')) > 0 THEN
    v_esc_date := (p_payload ->> 'escalationDate')::timestamptz;
  ELSE
    v_esc_date := NULL;
  END IF;
  IF v_lease_type = 'MONTH_TO_MONTH'::public.app_lease_type THEN
    v_lease_status := 'MONTH_TO_MONTH'::public.app_lease_status;
  ELSE
    v_lease_status := 'ACTIVE'::public.app_lease_status;
  END IF;
  UPDATE
    public.tenants t
  SET
    property_id = v_property_id,
    status = 'ACTIVE'::public.app_tenant_status,
    updated_at = now()
  WHERE
    t.id = v_tenant_id
    AND t.user_id = v_uid;
  INSERT INTO public.leases (user_id, property_id, tenant_id, start_date, fixed_term_end_date, lease_type, monthly_rent, deposit_amount, rent_due_day, escalation_percent, escalation_date, status, lease_document_id, notes)
    VALUES (v_uid, v_property_id, v_tenant_id, v_start, v_fixed_end, v_lease_type, v_monthly, v_deposit, v_rent_due, v_esc_pct, v_esc_date, v_lease_status, v_lease_doc, NULLIF (trim(coalesce(v_notes, '')), ''))
  RETURNING
    id INTO v_lease_id;
  IF v_create_rule THEN
    INSERT INTO public.recurring_income_rules (user_id, property_id, tenant_id, lease_id, category, amount, frequency, day_of_month, start_date, end_date, status, auto_create_expected_entries)
      VALUES (v_uid, v_property_id, v_tenant_id, v_lease_id, 'RENT'::public.app_property_income_category, v_monthly, 'MONTHLY'::public.app_recurring_frequency, v_rent_due, v_start, CASE WHEN v_lease_type = 'FIXED_TERM'::public.app_lease_type THEN
          v_fixed_end
        ELSE
          NULL
        END, 'ACTIVE'::public.app_recurring_income_rule_status, FALSE);
  END IF;
  SELECT
    * INTO v_row
  FROM
    public.leases
  WHERE
    id = v_lease_id;
  RETURN
    to_jsonb (v_row);
END;
$$;

COMMENT ON FUNCTION public.create_property_lease (jsonb) IS 'Creates a lease for an owned property/tenant, optional recurring rent rule; mirrors Express POST /properties/:id/leases transaction.';

-- ---------------------------------------------------------------------------
-- cancel_lease: rules + future expected income + lease status + tenant if last active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_lease (p_lease_id uuid, p_cancellation_date date, p_cancellation_reason text DEFAULT NULL, p_cancelled_by public.app_lease_cancelled_by DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease public.leases %ROWTYPE;
  v_cut timestamptz;
  v_other int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_cancellation_date IS NULL THEN
    RAISE EXCEPTION 'CANCELLATION_DATE_REQUIRED';
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
  IF v_lease.status IN ('CANCELLED', 'TERMINATED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'LEASE_ALREADY_CLOSED';
  END IF;
  v_cut := (p_cancellation_date::text || 'T00:00:00Z')::timestamptz;
  UPDATE
    public.recurring_income_rules r
  SET
    status = 'CANCELLED'::public.app_recurring_income_rule_status,
    updated_at = now()
  WHERE
    r.lease_id = p_lease_id
    AND r.user_id = v_uid;
  UPDATE
    public.income_entries i
  SET
    status = 'CANCELLED'::public.app_property_income_status,
    updated_at = now()
  WHERE
    i.lease_id = p_lease_id
    AND i.user_id = v_uid
    AND i.status = 'EXPECTED'::public.app_property_income_status
    AND i.income_date > v_cut;
  UPDATE
    public.leases l
  SET
    status = 'CANCELLED'::public.app_lease_status,
    cancellation_date = (p_cancellation_date::text || 'T00:00:00Z')::timestamptz,
    cancellation_reason = p_cancellation_reason,
    cancelled_by = p_cancelled_by,
    updated_at = now()
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid
  RETURNING
    * INTO v_lease;
  SELECT
    COUNT(*) INTO v_other
  FROM
    public.leases l
  WHERE
    l.user_id = v_uid
    AND l.tenant_id = v_lease.tenant_id
    AND l.id <> p_lease_id
    AND l.status IN ('ACTIVE', 'MONTH_TO_MONTH')
    AND l.cancellation_date IS NULL;
  IF v_other = 0 THEN
    UPDATE
      public.tenants t
    SET
      status = 'PAST'::public.app_tenant_status,
      property_id = NULL,
      updated_at = now()
    WHERE
      t.id = v_lease.tenant_id
      AND t.user_id = v_uid;
  END IF;
  RETURN
    to_jsonb (v_lease);
END;
$$;

COMMENT ON FUNCTION public.cancel_lease (uuid, date, text, public.app_lease_cancelled_by) IS 'Cancels a lease (owned by auth.uid()), cancels linked rent rules and future EXPECTED income, may mark tenant PAST when no other active lease.';

-- ---------------------------------------------------------------------------
-- delete_or_archive_lease: draft hard-delete vs archive (Express parity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_or_archive_lease (p_lease_id uuid)
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
  IF v_lease.status = 'DRAFT'::public.app_lease_status AND v_inv = 0 AND v_inc = 0 THEN
    DELETE FROM public.recurring_income_rules r
  WHERE r.lease_id = p_lease_id
    AND r.user_id = v_uid;
    DELETE FROM public.leases l
  WHERE l.id = p_lease_id
    AND l.user_id = v_uid;
    RETURN jsonb_build_object('deleted', TRUE, 'message', 'Deleted draft lease');
  END IF;
  UPDATE
    public.recurring_income_rules r
  SET
    status = 'CANCELLED'::public.app_recurring_income_rule_status,
    updated_at = now()
  WHERE
    r.lease_id = p_lease_id
    AND r.user_id = v_uid;
  UPDATE
    public.leases l
  SET
    status = 'ARCHIVED'::public.app_lease_status,
    updated_at = now()
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid
  RETURNING
    * INTO v_lease;
  RETURN
    jsonb_build_object('deleted', FALSE, 'message', 'Archived lease', 'lease', to_jsonb (v_lease));
END;
$$;

COMMENT ON FUNCTION public.delete_or_archive_lease (uuid) IS 'Deletes a draft lease with no invoice/income links; otherwise archives and cancels linked rent rules.';

GRANT EXECUTE ON FUNCTION public.create_property_lease (jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_lease (uuid, date, text, public.app_lease_cancelled_by) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_or_archive_lease (uuid) TO authenticated;
