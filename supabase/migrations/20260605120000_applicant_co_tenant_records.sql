-- Co-applicants: separate tenant rows linked by application_group_id; one directory row with combined names.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS application_group_id uuid,
  ADD COLUMN IF NOT EXISTS applicant_group_role text;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_applicant_group_role_chk;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_applicant_group_role_chk CHECK (
    applicant_group_role IS NULL
    OR applicant_group_role IN ('PRIMARY', 'CO')
  );

CREATE INDEX IF NOT EXISTS tenants_application_group_id_idx ON public.tenants (application_group_id)
WHERE
  application_group_id IS NOT NULL;

COMMENT ON COLUMN public.tenants.application_group_id IS 'Links primary and co-applicant tenant rows from the same application.';
COMMENT ON COLUMN public.tenants.applicant_group_role IS 'PRIMARY or CO when part of a joint application; NULL for ordinary tenants.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.applicant_group_primary_tenant_id (p_group_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
  SELECT
    t.id
  FROM
    public.tenants t
  WHERE
    t.application_group_id = p_group_id
    AND t.user_id = auth.uid ()
    AND coalesce(t.applicant_group_role, 'PRIMARY') = 'PRIMARY'
  ORDER BY
    t.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.applicant_group_co_tenant_id (p_group_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
  SELECT
    t.id
  FROM
    public.tenants t
  WHERE
    t.application_group_id = p_group_id
    AND t.user_id = auth.uid ()
    AND t.applicant_group_role = 'CO'
  ORDER BY
    t.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.applicant_display_full_name (p_first text, p_last text, p_co_first text, p_co_last text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    CASE WHEN coalesce(p_co_first, '') <> '' OR coalesce(p_co_last, '') <> '' THEN
      btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')) || ' & ' || btrim(coalesce(p_co_first, '') || ' ' || coalesce(p_co_last, ''))
    ELSE
      btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, ''))
    END;
$$;

-- Backfill co-applicant tenant rows for existing applications (JSONB only had one tenant before).
INSERT INTO public.tenants (
  user_id,
  first_name,
  last_name,
  email,
  phone,
  id_number,
  status,
  applied_property_id,
  applied_unit_id,
  application_group_id,
  applicant_group_role)
SELECT
  t.user_id,
  trim(coalesce(co_json ->> 'firstName', '')),
  trim(coalesce(co_json ->> 'lastName', '')),
  trim(coalesce(co_json ->> 'email', '')),
  nullif(trim(coalesce(co_json ->> 'phone', '')), ''),
  nullif(trim(coalesce(co_json ->> 'idNumber', '')), ''),
  'APPLICANT'::public.app_tenant_status,
  t.applied_property_id,
  t.applied_unit_id,
  coalesce(t.application_group_id, t.id),
  'CO'
FROM
  public.tenants t
  INNER JOIN public.applicant_application_details aad ON aad.tenant_id = t.id
  CROSS JOIN LATERAL (
    SELECT
      coalesce(aad.co_applicant, aad.form_data -> 'coApplicant') AS co_json) co
WHERE
  t.status = 'APPLICANT'::public.app_tenant_status
  AND coalesce(t.applicant_group_role, 'PRIMARY') = 'PRIMARY'
  AND co.co_json IS NOT NULL
  AND co.co_json <> 'null'::jsonb
  AND trim(coalesce(co.co_json ->> 'firstName', '')) <> ''
  AND trim(coalesce(co.co_json ->> 'lastName', '')) <> ''
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.tenants existing
    WHERE
      existing.application_group_id = coalesce(t.application_group_id, t.id)
      AND existing.applicant_group_role = 'CO'
      AND existing.user_id = t.user_id);

UPDATE
  public.tenants t
SET
  application_group_id = coalesce(t.application_group_id, t.id),
  applicant_group_role = 'PRIMARY'
WHERE
  t.status = 'APPLICANT'::public.app_tenant_status
  AND t.applicant_group_role IS NULL
  AND EXISTS (
    SELECT
      1
    FROM
      public.applicant_application_details aad
    WHERE
      aad.tenant_id = t.id);

-- ---------------------------------------------------------------------------
-- submit_applicant_application: create PRIMARY + optional CO tenant rows
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_applicant_application (p_token text, p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.applicant_invites %ROWTYPE;
  v_primary jsonb := coalesce(p_payload -> 'primary', '{}'::jsonb);
  v_co jsonb := p_payload -> 'coApplicant';
  v_co_enabled boolean := coalesce((p_payload ->> 'coApplicantEnabled')::boolean, FALSE);
  v_first text := trim(coalesce(v_primary ->> 'firstName', ''));
  v_last text := trim(coalesce(v_primary ->> 'lastName', ''));
  v_email text := trim(coalesce(v_primary ->> 'email', ''));
  v_phone text := nullif(trim(coalesce(v_primary ->> 'phone', '')), '');
  v_id_number text := nullif(trim(coalesce(v_primary ->> 'idNumber', '')), '');
  v_income double precision := coalesce((v_primary ->> 'monthlyIncome')::double precision, 0);
  v_co_first text;
  v_co_last text;
  v_co_email text;
  v_co_phone text;
  v_co_id_number text;
  v_co_income double precision := 0;
  v_prev text := nullif(trim(coalesce(v_primary ->> 'previousResidency', '')), '');
  v_landlord text := nullif(trim(coalesce(v_primary ->> 'landlordContact', '')), '');
  v_time_rented text := nullif(trim(coalesce(v_primary ->> 'timeRented', '')), '');
  v_group_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_co_tenant_id uuid;
  v_rent double precision;
  v_combined double precision;
  v_fit double precision;
BEGIN
  IF v_first = '' OR v_last = '' OR v_email = '' THEN
    RAISE EXCEPTION 'MISSING_REQUIRED_FIELDS';
  END IF;

  SELECT
    * INTO v_inv
  FROM
    public.applicant_invites i
  WHERE
    i.token = p_token
    AND i.revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  IF v_co_enabled AND v_co IS NOT NULL AND v_co <> 'null'::jsonb THEN
    v_co_first := trim(coalesce(v_co ->> 'firstName', ''));
    v_co_last := trim(coalesce(v_co ->> 'lastName', ''));
    v_co_email := trim(coalesce(v_co ->> 'email', ''));
    v_co_phone := nullif(trim(coalesce(v_co ->> 'phone', '')), '');
    v_co_id_number := nullif(trim(coalesce(v_co ->> 'idNumber', '')), '');
    v_co_income := coalesce((v_co ->> 'monthlyIncome')::double precision, 0);
    IF v_co_first = '' OR v_co_last = '' THEN
      RAISE EXCEPTION 'MISSING_CO_APPLICANT_FIELDS';
    END IF;
  ELSE
    v_co := NULL;
    v_co_enabled := FALSE;
    v_group_id := NULL;
  END IF;

  v_rent := public.resolve_property_target_rent(v_inv.property_id);
  v_combined := v_income + v_co_income;
  v_fit := public.compute_applicant_fit_score(v_combined, v_rent);

  INSERT INTO public.tenants (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    id_number,
    status,
    applied_property_id,
    applied_unit_id,
    application_group_id,
    applicant_group_role)
  VALUES (
    v_inv.user_id,
    v_first,
    v_last,
    v_email,
    v_phone,
    v_id_number,
    'APPLICANT',
    v_inv.property_id,
    v_inv.unit_id,
    v_group_id,
    CASE WHEN v_co_enabled THEN 'PRIMARY' ELSE NULL END)
  RETURNING
    id INTO v_tenant_id;

  IF NOT v_co_enabled THEN
    v_group_id := NULL;
  END IF;

  IF v_co_enabled THEN
    INSERT INTO public.tenants (
      user_id,
      first_name,
      last_name,
      email,
      phone,
      id_number,
      status,
      applied_property_id,
      applied_unit_id,
      application_group_id,
      applicant_group_role)
    VALUES (
      v_inv.user_id,
      v_co_first,
      v_co_last,
      nullif(v_co_email, ''),
      v_co_phone,
      v_co_id_number,
      'APPLICANT',
      v_inv.property_id,
      v_inv.unit_id,
      v_group_id,
      'CO')
    RETURNING
      id INTO v_co_tenant_id;
  END IF;

  INSERT INTO public.applicant_application_details (
    tenant_id,
    user_id,
    invite_id,
    property_id,
    monthly_income,
    co_applicant,
    previous_residency,
    landlord_contact,
    time_rented,
    target_rent,
    fit_score,
    form_data)
  VALUES (
    v_tenant_id,
    v_inv.user_id,
    v_inv.id,
    v_inv.property_id,
    v_combined,
    CASE WHEN v_co_enabled THEN v_co ELSE NULL END,
    v_prev,
    v_landlord,
    v_time_rented,
    v_rent,
    v_fit,
    p_payload);

  RETURN jsonb_build_object(
    'tenantId', v_tenant_id,
    'coTenantId', v_co_tenant_id,
    'applicationGroupId', v_group_id,
    'fitScore', v_fit);
END;
$$;

-- ---------------------------------------------------------------------------
-- update_applicant_application_owner: sync CO tenant row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_applicant_application_owner (p_tenant_id uuid, p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_detail public.applicant_application_details %ROWTYPE;
  v_primary_tenant public.tenants %ROWTYPE;
  v_primary_id uuid;
  v_group_id uuid;
  v_co_tenant_id uuid;
  v_primary jsonb := coalesce(p_payload -> 'primary', '{}'::jsonb);
  v_co jsonb := p_payload -> 'coApplicant';
  v_co_enabled boolean := coalesce((p_payload ->> 'coApplicantEnabled')::boolean, FALSE);
  v_first text := trim(coalesce(v_primary ->> 'firstName', ''));
  v_last text := trim(coalesce(v_primary ->> 'lastName', ''));
  v_email text := trim(coalesce(v_primary ->> 'email', ''));
  v_phone text := nullif(trim(coalesce(v_primary ->> 'phone', '')), '');
  v_id_number text := nullif(trim(coalesce(v_primary ->> 'idNumber', '')), '');
  v_income double precision := coalesce((v_primary ->> 'monthlyIncome')::double precision, 0);
  v_co_first text;
  v_co_last text;
  v_co_email text;
  v_co_phone text;
  v_co_id_number text;
  v_co_income double precision := 0;
  v_combined double precision;
  v_fit double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    * INTO v_primary_tenant
  FROM
    public.tenants t
  WHERE
    t.id = p_tenant_id
    AND t.user_id = v_uid
    AND t.status = 'APPLICANT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  v_primary_id := CASE WHEN v_primary_tenant.applicant_group_role = 'CO' AND v_primary_tenant.application_group_id IS NOT NULL THEN
    public.applicant_group_primary_tenant_id(v_primary_tenant.application_group_id)
  ELSE
    p_tenant_id
  END;

  IF v_primary_id IS NULL THEN
    v_primary_id := p_tenant_id;
  END IF;

  SELECT
    * INTO v_detail
  FROM
    public.applicant_application_details d
  WHERE
    d.tenant_id = v_primary_id
    AND d.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  IF v_first = '' OR v_last = '' OR v_email = '' THEN
    RAISE EXCEPTION 'MISSING_REQUIRED_FIELDS';
  END IF;

  v_group_id := v_primary_tenant.application_group_id;

  IF v_co_enabled AND v_co IS NOT NULL AND v_co <> 'null'::jsonb THEN
    v_co_first := trim(coalesce(v_co ->> 'firstName', ''));
    v_co_last := trim(coalesce(v_co ->> 'lastName', ''));
    v_co_email := trim(coalesce(v_co ->> 'email', ''));
    v_co_phone := nullif(trim(coalesce(v_co ->> 'phone', '')), '');
    v_co_id_number := nullif(trim(coalesce(v_co ->> 'idNumber', '')), '');
    v_co_income := coalesce((v_co ->> 'monthlyIncome')::double precision, 0);
    IF v_co_first = '' OR v_co_last = '' THEN
      RAISE EXCEPTION 'MISSING_CO_APPLICANT_FIELDS';
    END IF;
    IF v_group_id IS NULL THEN
      v_group_id := gen_random_uuid();
    END IF;
  ELSE
    v_co := NULL;
    v_co_enabled := FALSE;
  END IF;

  v_combined := v_income + v_co_income;
  v_fit := public.compute_applicant_fit_score(v_combined, v_detail.target_rent);

  UPDATE
    public.tenants t
  SET
    first_name = v_first,
    last_name = v_last,
    email = v_email,
    phone = v_phone,
    id_number = v_id_number,
    application_group_id = CASE WHEN v_co_enabled THEN v_group_id ELSE NULL END,
    applicant_group_role = CASE WHEN v_co_enabled THEN 'PRIMARY' ELSE NULL END,
    updated_at = now()
  WHERE
    t.id = v_primary_id
    AND t.user_id = v_uid;

  v_co_tenant_id := CASE WHEN v_group_id IS NOT NULL THEN
    public.applicant_group_co_tenant_id(v_group_id)
  END;

  IF v_co_enabled THEN
    IF v_co_tenant_id IS NULL THEN
      INSERT INTO public.tenants (
        user_id,
        first_name,
        last_name,
        email,
        phone,
        id_number,
        status,
        applied_property_id,
        applied_unit_id,
        application_group_id,
        applicant_group_role)
      VALUES (
        v_uid,
        v_co_first,
        v_co_last,
        nullif(v_co_email, ''),
        v_co_phone,
        v_co_id_number,
        'APPLICANT',
        v_primary_tenant.applied_property_id,
        v_primary_tenant.applied_unit_id,
        v_group_id,
        'CO')
      RETURNING
        id INTO v_co_tenant_id;
    ELSE
      UPDATE
        public.tenants t
      SET
        first_name = v_co_first,
        last_name = v_co_last,
        email = nullif(v_co_email, ''),
        phone = v_co_phone,
        id_number = v_co_id_number,
        application_group_id = v_group_id,
        applicant_group_role = 'CO',
        updated_at = now()
      WHERE
        t.id = v_co_tenant_id
        AND t.user_id = v_uid;
    END IF;
  ELSIF v_co_tenant_id IS NOT NULL THEN
    DELETE FROM public.tenants t
    WHERE t.id = v_co_tenant_id
      AND t.user_id = v_uid
      AND t.status = 'APPLICANT';
    v_co_tenant_id := NULL;
  END IF;

  UPDATE
    public.applicant_application_details d
  SET
    monthly_income = v_combined,
    co_applicant = CASE WHEN v_co_enabled THEN v_co ELSE NULL END,
    previous_residency = nullif(trim(coalesce(v_primary ->> 'previousResidency', '')), ''),
    landlord_contact = nullif(trim(coalesce(v_primary ->> 'landlordContact', '')), ''),
    time_rented = nullif(trim(coalesce(v_primary ->> 'timeRented', '')), ''),
    fit_score = v_fit,
    form_data = p_payload,
    updated_at = now()
  WHERE
    d.tenant_id = v_primary_id;

  RETURN jsonb_build_object(
    'tenantId', v_primary_id,
    'coTenantId', v_co_tenant_id,
    'applicationGroupId', v_group_id,
    'fitScore', v_fit);
END;
$$;

-- ---------------------------------------------------------------------------
-- get_applicant_application_owner: resolve primary + co tenant rows
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_applicant_application_owner (p_tenant_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_requested public.tenants %ROWTYPE;
  v_primary public.tenants %ROWTYPE;
  v_co public.tenants %ROWTYPE;
  v_detail public.applicant_application_details %ROWTYPE;
  v_primary_id uuid;
  v_co_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    * INTO v_requested
  FROM
    public.tenants t
  WHERE
    t.id = p_tenant_id
    AND t.user_id = v_uid
    AND t.status = 'APPLICANT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  IF v_requested.applicant_group_role = 'CO' AND v_requested.application_group_id IS NOT NULL THEN
    v_primary_id := public.applicant_group_primary_tenant_id(v_requested.application_group_id);
    v_co_id := v_requested.id;
  ELSE
    v_primary_id := v_requested.id;
    v_co_id := CASE WHEN v_requested.application_group_id IS NOT NULL THEN
      public.applicant_group_co_tenant_id(v_requested.application_group_id)
    END;
  END IF;

  SELECT
    * INTO v_primary
  FROM
    public.tenants t
  WHERE
    t.id = v_primary_id;

  IF v_co_id IS NOT NULL THEN
    SELECT
      * INTO v_co
    FROM
      public.tenants t
    WHERE
      t.id = v_co_id;
  END IF;

  SELECT
    * INTO v_detail
  FROM
    public.applicant_application_details d
  WHERE
    d.tenant_id = v_primary_id
    AND d.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_primary.id,
      'firstName', v_primary.first_name,
      'lastName', v_primary.last_name,
      'email', v_primary.email,
      'phone', v_primary.phone,
      'idNumber', v_primary.id_number,
      'appliedPropertyId', v_primary.applied_property_id,
      'appliedUnitId', v_primary.applied_unit_id,
      'applicationGroupId', v_primary.application_group_id,
      'coTenantId', v_co.id
    ),
    'activeTenant', jsonb_build_object(
      'id', v_requested.id,
      'firstName', v_requested.first_name,
      'lastName', v_requested.last_name,
      'email', v_requested.email,
      'phone', v_requested.phone,
      'idNumber', v_requested.id_number,
      'appliedPropertyId', v_requested.applied_property_id,
      'appliedUnitId', v_requested.applied_unit_id,
      'applicationGroupId', v_requested.application_group_id,
      'applicantGroupRole', v_requested.applicant_group_role
    ),
    'application', jsonb_build_object(
      'monthlyIncome', v_detail.monthly_income,
      'coApplicant', CASE WHEN v_co.id IS NOT NULL THEN
        jsonb_build_object(
          'firstName', v_co.first_name,
          'lastName', v_co.last_name,
          'email', v_co.email,
          'phone', v_co.phone,
          'idNumber', v_co.id_number,
          'monthlyIncome', coalesce(v_detail.co_applicant ->> 'monthlyIncome', v_detail.form_data -> 'coApplicant' ->> 'monthlyIncome')
        )
      ELSE
        v_detail.co_applicant
      END,
      'coApplicantEnabled', v_co.id IS NOT NULL,
      'previousResidency', v_detail.previous_residency,
      'landlordContact', v_detail.landlord_contact,
      'timeRented', v_detail.time_rented,
      'targetRent', v_detail.target_rent,
      'fitScore', v_detail.fit_score,
      'formData', v_detail.form_data,
      'submittedAt', v_detail.submitted_at
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_tenants_directory: one applicants-table row per joint application (combined names)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tenants_directory (
  p_limit integer DEFAULT 6,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_lease_status text DEFAULT NULL,
  p_payment_status text DEFAULT NULL,
  p_tab text DEFAULT 'tenants'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_lease_status text := nullif(trim(coalesce(p_lease_status, '')), '');
  v_payment_status text := nullif(trim(coalesce(p_payment_status, '')), '');
  v_tab text := lower(nullif(trim(coalesce(p_tab, '')), ''));
  v_pattern text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_metrics jsonb;
  v_applicant_metrics jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 6;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;
  IF v_tab IS NULL OR v_tab = '' THEN
    v_tab := 'tenants';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  WITH invoice_stats AS (
    SELECT
      i.tenant_id,
      count(*) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
      )::bigint AS unpaid_count,
      count(*) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
          AND i.due_date::date < CURRENT_DATE
      )::bigint AS overdue_count,
      coalesce(
        sum(i.total) FILTER (
          WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
        ),
        0
      ) AS outstanding_amount,
      min(i.due_date) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
      ) AS next_due_date,
      max(i.paid_at) FILTER (WHERE i.status = 'PAID'::public.app_invoice_status) AS last_paid_at
    FROM public.invoices i
    WHERE i.user_id = v_uid
    GROUP BY i.tenant_id
  ),
  current_leases AS (
    SELECT DISTINCT ON (l.tenant_id)
      l.id,
      l.tenant_id,
      l.property_id,
      l.start_date,
      l.fixed_term_end_date,
      l.monthly_rent,
      l.status,
      p.name AS property_name,
      p.address_line1,
      p.address_line2,
      p.suburb,
      p.city
    FROM public.leases l
    INNER JOIN public.properties p ON p.id = l.property_id
    WHERE l.user_id = v_uid
    ORDER BY
      l.tenant_id,
      CASE
        WHEN public.is_current_lease_status(
          public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
        ) THEN 0
        ELSE 1
      END,
      l.start_date DESC NULLS LAST,
      l.created_at DESC
  ),
  base AS (
    SELECT
      t.*,
      tp.name AS linked_property_name,
      tp.address_line1 AS linked_address_line1,
      tp.address_line2 AS linked_address_line2,
      tp.suburb AS linked_suburb,
      tp.city AS linked_city,
      ap.name AS applied_property_name,
      ap.address_line1 AS applied_address_line1,
      ap.address_line2 AS applied_address_line2,
      ap.suburb AS applied_suburb,
      ap.city AS applied_city,
      cl.id AS lease_id,
      cl.property_id AS lease_property_id,
      cl.start_date AS lease_start_date,
      cl.fixed_term_end_date AS lease_end_date,
      cl.monthly_rent AS lease_monthly_rent,
      cl.status AS lease_status_raw,
      cl.property_name AS lease_property_name,
      cl.address_line1 AS lease_address_line1,
      cl.address_line2 AS lease_address_line2,
      cl.suburb AS lease_suburb,
      cl.city AS lease_city,
      coalesce(is_stats.unpaid_count, 0) AS unpaid_count,
      coalesce(is_stats.overdue_count, 0) AS overdue_count,
      coalesce(is_stats.outstanding_amount, 0) AS outstanding_amount,
      is_stats.next_due_date,
      is_stats.last_paid_at,
      public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date) AS lease_display_status,
      public.is_current_lease_status(
        public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date)
      ) AS has_current_lease,
      public.derive_tenant_lease_status(cl.status::text, cl.fixed_term_end_date::date) AS derived_lease_status,
      public.derive_tenant_payment_status(
        public.is_current_lease_status(
          public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date)
        ),
        coalesce(is_stats.unpaid_count, 0),
        coalesce(is_stats.overdue_count, 0)
      ) AS derived_payment_status,
      aad.monthly_income AS applicant_monthly_income,
      aad.fit_score AS applicant_fit_score,
      aad.target_rent AS applicant_target_rent,
      aad.submitted_at AS applicant_submitted_at
    FROM public.tenants t
    LEFT JOIN public.properties tp ON tp.id = t.property_id
    LEFT JOIN public.properties ap ON ap.id = t.applied_property_id
    LEFT JOIN current_leases cl ON cl.tenant_id = t.id
    LEFT JOIN invoice_stats is_stats ON is_stats.tenant_id = t.id
    LEFT JOIN public.applicant_application_details aad ON aad.tenant_id = CASE WHEN t.applicant_group_role = 'CO' AND t.application_group_id IS NOT NULL THEN
      public.applicant_group_primary_tenant_id(t.application_group_id)
    ELSE
      t.id
    END
      AND aad.user_id = v_uid
    WHERE
      t.user_id = v_uid
      AND (
        v_tab = 'applicants' AND t.status = 'APPLICANT'::public.app_tenant_status
        OR v_tab <> 'applicants' AND t.status <> 'APPLICANT'::public.app_tenant_status
      )
      AND (
        v_tab <> 'applicants'
        OR coalesce(t.applicant_group_role, 'PRIMARY') <> 'CO'
      )
      AND (p_property_id IS NULL OR coalesce(cl.property_id, t.property_id, t.applied_property_id) = p_property_id)
      AND (
        v_search IS NULL
        OR t.first_name ILIKE v_pattern
        OR t.last_name ILIKE v_pattern
        OR t.email ILIKE v_pattern
        OR t.phone ILIKE v_pattern
        OR coalesce(cl.property_name, tp.name, ap.name, '') ILIKE v_pattern
        OR coalesce(cl.address_line1, tp.address_line1, ap.address_line1, '') ILIKE v_pattern
        OR coalesce(cl.suburb, tp.suburb, ap.suburb, '') ILIKE v_pattern
        OR coalesce(cl.city, tp.city, ap.city, '') ILIKE v_pattern
        OR EXISTS (
          SELECT
            1
          FROM
            public.tenants co_s
          WHERE
            co_s.application_group_id = t.application_group_id
            AND co_s.applicant_group_role = 'CO'
            AND co_s.user_id = v_uid
            AND (
              co_s.first_name ILIKE v_pattern
              OR co_s.last_name ILIKE v_pattern
              OR coalesce(co_s.email, '') ILIKE v_pattern
              OR coalesce(co_s.phone, '') ILIKE v_pattern))
      )
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE
      (v_lease_status IS NULL OR v_lease_status = 'ALL' OR b.derived_lease_status = v_lease_status)
      AND (v_payment_status IS NULL OR v_payment_status = 'ALL' OR b.derived_payment_status = v_payment_status)
  ),
  metrics AS (
    SELECT
      count(*)::integer AS total_tenants,
      count(*) FILTER (
        WHERE derived_lease_status IN ('active', 'ending_soon', 'notice')
      )::integer AS active_leases,
      count(*) FILTER (
        WHERE derived_payment_status IN ('overdue', 'pending', 'partial')
      )::integer AS pending_payments_count,
      coalesce(
        sum(outstanding_amount) FILTER (
          WHERE derived_payment_status IN ('overdue', 'pending', 'partial')
        ),
        0
      ) AS pending_payments_total,
      count(*) FILTER (
        WHERE lease_end_date IS NOT NULL
          AND lease_end_date::date >= CURRENT_DATE
          AND lease_end_date::date <= (CURRENT_DATE + 30)
          AND derived_lease_status IN ('active', 'ending_soon')
      )::integer AS renewals_due,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
      )::integer AS total_applicants,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
          AND property_id IS NULL
          AND applied_property_id IS NULL
          AND lease_property_id IS NULL
      )::integer AS awaiting_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
          AND coalesce(lease_property_id, property_id, applied_property_id) IS NOT NULL
      )::integer AS linked_to_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
          AND coalesce(lease_property_id, property_id, applied_property_id) IS NOT NULL
          AND lease_id IS NULL
      )::integer AS ready_for_lease
    FROM base
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC, id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM filtered),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pr.id::text,
            'firstName', pr.first_name,
            'lastName', pr.last_name,
            'fullName', public.applicant_display_full_name(pr.first_name, pr.last_name, co_pr.first_name, co_pr.last_name),
            'email', CASE WHEN co_pr.id IS NOT NULL AND coalesce(pr.email, '') <> '' AND coalesce(co_pr.email, '') <> '' THEN
              pr.email || ' & ' || co_pr.email
            WHEN co_pr.id IS NOT NULL AND coalesce(co_pr.email, '') <> '' THEN
              co_pr.email
            ELSE
              pr.email
            END,
            'phone', CASE WHEN co_pr.id IS NOT NULL AND coalesce(pr.phone, '') <> '' AND coalesce(co_pr.phone, '') <> '' THEN
              pr.phone || ' & ' || co_pr.phone
            WHEN co_pr.id IS NOT NULL AND coalesce(co_pr.phone, '') <> '' THEN
              co_pr.phone
            ELSE
              pr.phone
            END,
            'avatarUrl', NULL,
            'tenantStatus', pr.status::text,
            'propertyId', coalesce(pr.lease_property_id, pr.property_id, pr.applied_property_id)::text,
            'propertyName', coalesce(pr.lease_property_name, pr.linked_property_name, pr.applied_property_name),
            'propertyAddress', nullif(
              btrim(
                concat_ws(
                  ', ',
                  coalesce(pr.lease_address_line1, pr.linked_address_line1, pr.applied_address_line1),
                  coalesce(pr.lease_suburb, pr.linked_suburb, pr.applied_suburb),
                  coalesce(pr.lease_city, pr.linked_city, pr.applied_city)
                )
              ),
              ''
            ),
            'unitNumber', coalesce(pr.lease_address_line2, pr.linked_address_line2, pr.applied_address_line2),
            'leaseId', pr.lease_id::text,
            'monthlyRent', pr.lease_monthly_rent,
            'leaseStartDate', CASE WHEN pr.lease_start_date IS NULL THEN NULL ELSE to_char(pr.lease_start_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'leaseEndDate', CASE WHEN pr.lease_end_date IS NULL THEN NULL ELSE to_char(pr.lease_end_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'leaseStatus', pr.derived_lease_status,
            'leaseDisplayStatus', pr.lease_display_status,
            'paymentStatus', pr.derived_payment_status,
            'outstandingAmount', CASE WHEN pr.outstanding_amount > 0 THEN pr.outstanding_amount ELSE NULL END,
            'lastPaymentDate', CASE WHEN pr.last_paid_at IS NULL THEN NULL ELSE to_char(pr.last_paid_at, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'nextPaymentDueDate', CASE WHEN pr.next_due_date IS NULL THEN NULL ELSE to_char(pr.next_due_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'monthlyIncome', pr.applicant_monthly_income,
            'fitScore', pr.applicant_fit_score,
            'targetRent', pr.applicant_target_rent,
            'applicationSubmittedAt', CASE WHEN pr.applicant_submitted_at IS NULL THEN NULL ELSE to_char(pr.applicant_submitted_at, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'applicationGroupId', pr.application_group_id::text,
            'coApplicantTenantId', co_pr.id::text,
            'memberTenantIds', CASE WHEN co_pr.id IS NOT NULL THEN
              jsonb_build_array(pr.id::text, co_pr.id::text)
            ELSE
              jsonb_build_array(pr.id::text)
            END
          )
          ORDER BY pr.created_at DESC, pr.id ASC
        )
        FROM page_rows pr
        LEFT JOIN public.tenants co_pr ON co_pr.application_group_id = pr.application_group_id
          AND co_pr.applicant_group_role = 'CO'
          AND co_pr.user_id = v_uid
      ),
      '[]'::jsonb
    ),
    (
      SELECT jsonb_build_object(
        'totalTenants', m.total_tenants,
        'activeLeases', m.active_leases,
        'pendingPaymentsTotal', m.pending_payments_total,
        'pendingPaymentsCount', m.pending_payments_count,
        'renewalsDue', m.renewals_due
      )
      FROM metrics m
    ),
    (
      SELECT jsonb_build_object(
        'totalApplicants', m.total_applicants,
        'awaitingProperty', m.awaiting_property,
        'linkedToProperty', m.linked_to_property,
        'readyForLease', m.ready_for_lease
      )
      FROM metrics m
    )
  INTO v_total, v_items, v_metrics, v_applicant_metrics
  FROM metrics
  LIMIT 1;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0),
    'metrics', coalesce(v_metrics, '{}'::jsonb),
    'applicantMetrics', coalesce(v_applicant_metrics, '{}'::jsonb)
  );
END;
$function$;
