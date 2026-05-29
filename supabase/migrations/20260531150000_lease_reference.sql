-- Unique lease reference (LSE-YY-####) generated at lease creation; shown on invoices.

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS lease_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS leases_user_id_lease_reference_unique_idx
  ON public.leases (user_id, lease_reference)
  WHERE lease_reference IS NOT NULL;

COMMENT ON COLUMN public.leases.lease_reference IS
  'User-scoped lease reference (LSE-YY-####), generated on create; used as invoice payment reference.';

CREATE OR REPLACE FUNCTION public.generate_lease_reference (p_user_id uuid DEFAULT auth.uid())
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_yy text;
  v_seq integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_yy := to_char(timezone('UTC', now()), 'YY');

  SELECT coalesce(max(
    CASE
      WHEN l.lease_reference ~ ('^LSE-' || v_yy || '-[0-9]{4}$') THEN
        substring(l.lease_reference from '[0-9]{4}$')::integer
      ELSE NULL
    END
  ), 0) + 1
  INTO v_seq
  FROM public.leases l
  WHERE l.user_id = v_uid;

  IF v_seq IS NULL OR v_seq < 1 THEN
    v_seq := 1;
  END IF;

  RETURN 'LSE-' || v_yy || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_lease_reference (uuid) IS
  'User-scoped lease references LSE-YY-#### (sequence per calendar year).';

-- Backfill existing leases (oldest first per user/year).
DO $$
DECLARE
  r record;
  v_ref text;
BEGIN
  FOR r IN
    SELECT l.id, l.user_id
    FROM public.leases l
    WHERE l.lease_reference IS NULL
    ORDER BY l.user_id, l.created_at ASC, l.id ASC
  LOOP
    v_ref := public.generate_lease_reference(r.user_id);
    UPDATE public.leases
    SET lease_reference = v_ref, updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.leases
  ALTER COLUMN lease_reference SET NOT NULL;

-- create_property_lease: assign lease_reference on insert
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
  v_rent_split boolean := coalesce((p_payload ->> 'rentSplitEnabled')::boolean, FALSE);
  v_esc_pct double precision;
  v_esc_date timestamptz;
  v_notes text := p_payload ->> 'notes';
  v_lease_doc uuid;
  v_create_rule boolean := coalesce((p_payload ->> 'createExpectedRentRule')::boolean, TRUE);
  v_lease_status public.app_lease_status;
  v_lease_id uuid;
  v_lease_ref text;
  v_row public.leases %ROWTYPE;
  v_active int;
  v_tenant jsonb;
  v_tid uuid;
  v_role text;
  v_is_primary boolean;
  v_share double precision;
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

  PERFORM 1 FROM public.properties p WHERE p.id = v_property_id AND p.user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  IF v_unit_id IS NOT NULL THEN
    PERFORM 1 FROM public.property_units u
    WHERE u.id = v_unit_id AND u.property_id = v_property_id AND u.user_id = v_uid;
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

  FOR v_tenant IN SELECT * FROM jsonb_array_elements(v_lease_tenants) LOOP
    v_tid := (v_tenant ->> 'tenantId')::uuid;
    IF v_tid IS NULL THEN
      RAISE EXCEPTION 'INVALID_TENANT';
    END IF;
    PERFORM 1 FROM public.tenants t WHERE t.id = v_tid AND t.user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_TENANT';
    END IF;
    SELECT COUNT(*) INTO v_active
    FROM public.lease_tenants lt
    JOIN public.leases l ON l.id = lt.lease_id
    WHERE lt.tenant_id = v_tid AND lt.user_id = v_uid
      AND l.status IN ('ACTIVE', 'MONTH_TO_MONTH') AND l.cancellation_date IS NULL;
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
  ELSIF v_fixed_end IS NOT NULL AND v_fixed_end <= v_start THEN
    RAISE EXCEPTION 'FIXED_TERM_END_AFTER_START';
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

  v_lease_ref := public.generate_lease_reference(v_uid);

  INSERT INTO public.leases (
    user_id, property_id, unit_id, tenant_id, start_date, fixed_term_end_date,
    lease_type, monthly_rent, deposit_amount, rent_due_day, rent_split_enabled,
    escalation_percent, escalation_date, status, lease_document_id, notes, lease_reference
  )
  VALUES (
    v_uid, v_property_id, v_unit_id, v_primary_tenant_id, v_start, v_fixed_end,
    v_lease_type, v_monthly, v_deposit, v_rent_due, v_rent_split,
    v_esc_pct, v_esc_date, v_lease_status, v_lease_doc,
    NULLIF (trim(coalesce(v_notes, '')), ''), v_lease_ref
  )
  RETURNING id INTO v_lease_id;

  FOR v_tenant IN SELECT * FROM jsonb_array_elements(v_lease_tenants) LOOP
    v_tid := (v_tenant ->> 'tenantId')::uuid;
    v_role := coalesce(NULLIF (trim(v_tenant ->> 'role'), ''), 'co_tenant');
    v_is_primary := coalesce((v_tenant ->> 'isPrimary')::boolean, v_tid = v_primary_tenant_id);
    IF v_is_primary THEN
      v_role := 'primary_tenant';
    END IF;
    IF v_tenant ? 'rentShareAmount' AND v_tenant ->> 'rentShareAmount' IS NOT NULL AND length(trim(v_tenant ->> 'rentShareAmount')) > 0 THEN
      v_share := (v_tenant ->> 'rentShareAmount')::double precision;
    ELSE
      v_share := NULL;
    END IF;
    INSERT INTO public.lease_tenants (lease_id, tenant_id, user_id, role, is_primary, rent_share_amount)
      VALUES (v_lease_id, v_tid, v_uid, v_role, v_is_primary, v_share);
  END LOOP;

  IF v_create_rule THEN
    INSERT INTO public.recurring_income_rules (
      user_id, property_id, tenant_id, lease_id, category, amount, frequency,
      day_of_month, start_date, end_date, status, auto_create_expected_entries
    )
    VALUES (
      v_uid, v_property_id, v_primary_tenant_id, v_lease_id, 'RENT'::public.app_property_income_category,
      v_monthly, 'MONTHLY'::public.app_recurring_frequency, v_rent_due, v_start,
      v_fixed_end, 'ACTIVE'::public.app_recurring_income_rule_status, FALSE
    );
  END IF;

  SELECT * INTO v_row FROM public.leases WHERE id = v_lease_id;
  RETURN to_jsonb (v_row);
END;
$$;
