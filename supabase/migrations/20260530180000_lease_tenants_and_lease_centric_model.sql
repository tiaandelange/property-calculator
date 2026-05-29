-- Lease-centric occupancy: leases.unit_id + lease_tenants join table.
-- Tenants are global records; property/unit occupancy flows through leases only.

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.property_units (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leases_unit_id_idx ON public.leases (unit_id);

COMMENT ON COLUMN public.leases.unit_id IS
  'Optional unit within property_id. Occupancy source of truth together with lease_tenants.';

CREATE TABLE IF NOT EXISTS public.lease_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary_tenant',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lease_tenants_role_check CHECK (
    role IN ('primary_tenant', 'co_tenant', 'spouse', 'occupant', 'guarantor')
  ),
  CONSTRAINT lease_tenants_lease_tenant_unique UNIQUE (lease_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS lease_tenants_lease_id_idx ON public.lease_tenants (lease_id);
CREATE INDEX IF NOT EXISTS lease_tenants_tenant_id_idx ON public.lease_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS lease_tenants_user_id_idx ON public.lease_tenants (user_id);

COMMENT ON TABLE public.lease_tenants IS
  'Tenants attached to a lease. Leases are the source of truth for property/unit occupancy.';

ALTER TABLE public.lease_tenants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lease_tenants TO authenticated;

DROP POLICY IF EXISTS lease_tenants_all_own ON public.lease_tenants;

CREATE POLICY lease_tenants_all_own ON public.lease_tenants
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_tenants.lease_id
        AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.leases l
      WHERE l.id = lease_id
        AND l.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = tenant_id
        AND t.user_id = auth.uid()
    )
  );

-- Backfill primary lease tenant rows from existing leases.tenant_id
INSERT INTO public.lease_tenants (lease_id, tenant_id, user_id, role, is_primary)
SELECT
  l.id,
  l.tenant_id,
  l.user_id,
  'primary_tenant',
  TRUE
FROM
  public.leases l
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.lease_tenants lt
    WHERE
      lt.lease_id = l.id
      AND lt.tenant_id = l.tenant_id
  );

-- ---------------------------------------------------------------------------
-- create_property_lease: lease + lease_tenants (+ optional rent rule); no tenant.property_id writes
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
  v_unit_id uuid;
  v_primary_tenant_id uuid := (p_payload ->> 'tenantId')::uuid;
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
  v_tenant jsonb;
  v_tid uuid;
  v_role text;
  v_is_primary boolean;
  v_lease_tenants jsonb := coalesce(p_payload -> 'leaseTenants', '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF v_property_id IS NULL OR v_primary_tenant_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PROPERTY_OR_TENANT';
  END IF;
  IF v_monthly < 0 OR v_deposit < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_AMOUNT';
  END IF;
  IF v_rent_due < 1 OR v_rent_due > 31 THEN
    RAISE EXCEPTION 'INVALID_RENT_DUE_DAY';
  END IF;

  IF p_payload ? 'unitId' AND p_payload ->> 'unitId' IS NOT NULL AND length(trim(p_payload ->> 'unitId')) > 0 THEN
    v_unit_id := (p_payload ->> 'unitId')::uuid;
  ELSE
    v_unit_id := NULL;
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

  IF v_unit_id IS NOT NULL THEN
    PERFORM
      1
    FROM
      public.property_units u
    WHERE
      u.id = v_unit_id
      AND u.property_id = v_property_id
      AND u.user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_UNIT';
    END IF;
  END IF;

  IF jsonb_array_length(v_lease_tenants) = 0 THEN
    v_lease_tenants := jsonb_build_array(jsonb_build_object(
      'tenantId', v_primary_tenant_id::text,
      'role', 'primary_tenant',
      'isPrimary', TRUE
    ));
  END IF;

  FOR v_tenant IN
  SELECT
    *
  FROM
    jsonb_array_elements(v_lease_tenants)
    LOOP
      v_tid := (v_tenant ->> 'tenantId')::uuid;
      IF v_tid IS NULL THEN
        RAISE EXCEPTION 'INVALID_TENANT';
      END IF;
      PERFORM
        1
      FROM
        public.tenants t
      WHERE
        t.id = v_tid
        AND t.user_id = v_uid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_TENANT';
      END IF;
      SELECT
        COUNT(*) INTO v_active
      FROM
        public.lease_tenants lt
        JOIN public.leases l ON l.id = lt.lease_id
      WHERE
        lt.tenant_id = v_tid
        AND lt.user_id = v_uid
        AND l.status IN ('ACTIVE', 'MONTH_TO_MONTH')
        AND l.cancellation_date IS NULL;
      IF v_active > 0 THEN
        RAISE EXCEPTION 'TENANT_HAS_ACTIVE_LEASE';
      END IF;
    END LOOP;

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

  INSERT INTO public.leases (
    user_id,
    property_id,
    unit_id,
    tenant_id,
    start_date,
    fixed_term_end_date,
    lease_type,
    monthly_rent,
    deposit_amount,
    rent_due_day,
    escalation_percent,
    escalation_date,
    status,
    lease_document_id,
    notes
  )
    VALUES (
      v_uid,
      v_property_id,
      v_unit_id,
      v_primary_tenant_id,
      v_start,
      v_fixed_end,
      v_lease_type,
      v_monthly,
      v_deposit,
      v_rent_due,
      v_esc_pct,
      v_esc_date,
      v_lease_status,
      v_lease_doc,
      NULLIF (trim(coalesce(v_notes, '')), '')
    )
  RETURNING
    id INTO v_lease_id;

  FOR v_tenant IN
  SELECT
    *
  FROM
    jsonb_array_elements(v_lease_tenants)
    LOOP
      v_tid := (v_tenant ->> 'tenantId')::uuid;
      v_role := coalesce(NULLIF (trim(v_tenant ->> 'role'), ''), 'occupant');
      v_is_primary := coalesce((v_tenant ->> 'isPrimary')::boolean, v_tid = v_primary_tenant_id);
      INSERT INTO public.lease_tenants (lease_id, tenant_id, user_id, role, is_primary)
        VALUES (v_lease_id, v_tid, v_uid, v_role, v_is_primary);
    END LOOP;

  IF v_create_rule THEN
    INSERT INTO public.recurring_income_rules (user_id, property_id, tenant_id, lease_id, category, amount, frequency, day_of_month, start_date, end_date, status, auto_create_expected_entries)
      VALUES (v_uid, v_property_id, v_primary_tenant_id, v_lease_id, 'RENT'::public.app_property_income_category, v_monthly, 'MONTHLY'::public.app_recurring_frequency, v_rent_due, v_start, CASE WHEN v_lease_type = 'FIXED_TERM'::public.app_lease_type THEN
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

COMMENT ON FUNCTION public.create_property_lease (jsonb) IS
  'Creates a lease with lease_tenants rows. Does not write tenants.property_id. Supports unitId and leaseTenants array.';

-- ---------------------------------------------------------------------------
-- cancel_lease: preserve global tenant records (no property_id / status mutation)
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
  RETURN
    to_jsonb (v_lease);
END;
$$;

COMMENT ON FUNCTION public.cancel_lease (uuid, date, text, public.app_lease_cancelled_by) IS
  'Cancels a lease and future expected income. Preserves tenant records and financial history.';

-- ---------------------------------------------------------------------------
-- hard_delete_lease: cascade financials + lease_tenants; never delete tenants
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
  DELETE FROM public.lease_tenants lt
  WHERE lt.lease_id = p_lease_id
    AND lt.user_id = v_uid;
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
  'Permanently deletes a lease, lease_tenants, and linked financial rows. Tenant records are preserved.';
