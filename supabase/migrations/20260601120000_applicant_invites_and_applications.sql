-- Applicant share links + application details + public submit RPCs.

CREATE TABLE IF NOT EXISTS public.applicant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.property_units (id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE DEFAULT replace((gen_random_uuid()::text || gen_random_uuid()::text), '-', ''),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_invites_property_owned CHECK (property_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS applicant_invites_user_id_idx ON public.applicant_invites (user_id);
CREATE INDEX IF NOT EXISTS applicant_invites_property_id_idx ON public.applicant_invites (property_id);
CREATE UNIQUE INDEX IF NOT EXISTS applicant_invites_active_property_idx ON public.applicant_invites (user_id, property_id)
WHERE
  revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.applicant_application_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.applicant_invites (id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  monthly_income double precision NOT NULL DEFAULT 0,
  co_applicant jsonb,
  previous_residency text,
  landlord_contact text,
  time_rented text,
  target_rent double precision NOT NULL DEFAULT 0,
  fit_score double precision NOT NULL DEFAULT 0,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_application_details_fit_score_range CHECK (fit_score >= 0 AND fit_score <= 100)
);

CREATE INDEX IF NOT EXISTS applicant_application_details_user_id_idx ON public.applicant_application_details (user_id);
CREATE INDEX IF NOT EXISTS applicant_application_details_property_id_idx ON public.applicant_application_details (property_id);

CREATE TRIGGER applicant_invites_set_updated_at
BEFORE UPDATE ON public.applicant_invites
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER applicant_application_details_set_updated_at
BEFORE UPDATE ON public.applicant_application_details
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.applicant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_application_details ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.applicant_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.applicant_application_details TO authenticated;

CREATE POLICY applicant_invites_all_own ON public.applicant_invites
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY applicant_application_details_all_own ON public.applicant_application_details
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_property_target_rent (p_property_id uuid)
  RETURNS double precision
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
  SELECT
    coalesce((
      SELECT
        l.monthly_rent
      FROM
        public.leases l
      WHERE
        l.property_id = p_property_id
        AND l.status IN ('ACTIVE', 'MONTH_TO_MONTH', 'DRAFT')
      ORDER BY
        l.created_at DESC
      LIMIT 1), (
      SELECT
        p.expected_monthly_income
      FROM
        public.properties p
      WHERE
        p.id = p_property_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.compute_applicant_fit_score (p_combined_income double precision, p_target_rent double precision)
  RETURNS double precision
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  v_required double precision;
BEGIN
  IF coalesce(p_target_rent, 0) <= 0 THEN
    RETURN 0;
  END IF;
  v_required := p_target_rent * 3;
  IF coalesce(p_combined_income, 0) <= 0 THEN
    RETURN 0;
  END IF;
  IF p_combined_income >= v_required THEN
    RETURN 100;
  END IF;
  RETURN round(least(100, greatest(0, (p_combined_income / v_required) * 100))::numeric, 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- Owner: get or create invite token for a property
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_applicant_invite (
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.applicant_invites %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM
    1
  FROM
    public.properties p
  WHERE
    p.id = p_property_id
    AND p.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  SELECT
    * INTO v_row
  FROM
    public.applicant_invites i
  WHERE
    i.user_id = v_uid
    AND i.property_id = p_property_id
    AND i.revoked_at IS NULL
  ORDER BY
    i.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.applicant_invites (user_id, property_id, unit_id)
      VALUES (v_uid, p_property_id, p_unit_id)
    RETURNING
      * INTO v_row;
  ELSIF p_unit_id IS NOT NULL AND v_row.unit_id IS DISTINCT FROM p_unit_id THEN
    UPDATE
      public.applicant_invites
    SET
      unit_id = p_unit_id,
      updated_at = now()
    WHERE
      id = v_row.id
    RETURNING
      * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'token', v_row.token,
    'propertyId', v_row.property_id,
    'unitId', v_row.unit_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_applicant_invite (uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public: invite context (token only — no auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_applicant_invite_public (p_token text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.applicant_invites %ROWTYPE;
  v_property public.properties %ROWTYPE;
  v_unit public.property_units %ROWTYPE;
  v_rent double precision;
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

  SELECT
    * INTO v_property
  FROM
    public.properties p
  WHERE
    p.id = v_inv.property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  IF v_inv.unit_id IS NOT NULL THEN
    SELECT
      * INTO v_unit
    FROM
      public.property_units u
    WHERE
      u.id = v_inv.unit_id;
  END IF;

  v_rent := public.resolve_property_target_rent(v_inv.property_id);

  RETURN jsonb_build_object(
    'propertyName', v_property.name,
    'propertyAddress', trim(both ', ' FROM concat_ws(', ', v_property.address_line1, v_property.suburb, v_property.city)),
    'unitName', v_unit.unit_name,
    'targetRent', v_rent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_applicant_invite_public (text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: submit application
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
  v_co_income double precision := 0;
  v_prev text := nullif(trim(coalesce(v_primary ->> 'previousResidency', '')), '');
  v_landlord text := nullif(trim(coalesce(v_primary ->> 'landlordContact', '')), '');
  v_time_rented text := nullif(trim(coalesce(v_primary ->> 'timeRented', '')), '');
  v_tenant_id uuid;
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
    v_co_income := coalesce((v_co ->> 'monthlyIncome')::double precision, 0);
  ELSE
    v_co := NULL;
    v_co_enabled := FALSE;
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
    applied_unit_id)
  VALUES (
    v_inv.user_id,
    v_first,
    v_last,
    v_email,
    v_phone,
    v_id_number,
    'APPLICANT',
    v_inv.property_id,
    v_inv.unit_id)
  RETURNING
    id INTO v_tenant_id;

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

  RETURN jsonb_build_object('tenantId', v_tenant_id, 'fitScore', v_fit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_applicant_application (text, jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner: update application (override applicant data)
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
  v_primary jsonb := coalesce(p_payload -> 'primary', '{}'::jsonb);
  v_co jsonb := p_payload -> 'coApplicant';
  v_co_enabled boolean := coalesce((p_payload ->> 'coApplicantEnabled')::boolean, FALSE);
  v_first text := trim(coalesce(v_primary ->> 'firstName', ''));
  v_last text := trim(coalesce(v_primary ->> 'lastName', ''));
  v_email text := trim(coalesce(v_primary ->> 'email', ''));
  v_phone text := nullif(trim(coalesce(v_primary ->> 'phone', '')), '');
  v_id_number text := nullif(trim(coalesce(v_primary ->> 'idNumber', '')), '');
  v_income double precision := coalesce((v_primary ->> 'monthlyIncome')::double precision, 0);
  v_co_income double precision := 0;
  v_combined double precision;
  v_fit double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    * INTO v_detail
  FROM
    public.applicant_application_details d
  WHERE
    d.tenant_id = p_tenant_id
    AND d.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  IF v_first = '' OR v_last = '' OR v_email = '' THEN
    RAISE EXCEPTION 'MISSING_REQUIRED_FIELDS';
  END IF;

  IF v_co_enabled AND v_co IS NOT NULL AND v_co <> 'null'::jsonb THEN
    v_co_income := coalesce((v_co ->> 'monthlyIncome')::double precision, 0);
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
    updated_at = now()
  WHERE
    t.id = p_tenant_id
    AND t.user_id = v_uid
    AND t.status = 'APPLICANT';

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
    d.tenant_id = p_tenant_id;

  RETURN jsonb_build_object('tenantId', p_tenant_id, 'fitScore', v_fit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_applicant_application_owner (uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Owner: fetch application detail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_applicant_application_owner (p_tenant_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant public.tenants %ROWTYPE;
  v_detail public.applicant_application_details %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    * INTO v_tenant
  FROM
    public.tenants t
  WHERE
    t.id = p_tenant_id
    AND t.user_id = v_uid
    AND t.status = 'APPLICANT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND';
  END IF;

  SELECT
    * INTO v_detail
  FROM
    public.applicant_application_details d
  WHERE
    d.tenant_id = p_tenant_id
    AND d.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'firstName', v_tenant.first_name,
      'lastName', v_tenant.last_name,
      'email', v_tenant.email,
      'phone', v_tenant.phone,
      'idNumber', v_tenant.id_number,
      'appliedPropertyId', v_tenant.applied_property_id,
      'appliedUnitId', v_tenant.applied_unit_id
    ),
    'application', jsonb_build_object(
      'monthlyIncome', v_detail.monthly_income,
      'coApplicant', v_detail.co_applicant,
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

GRANT EXECUTE ON FUNCTION public.get_applicant_application_owner (uuid) TO authenticated;
