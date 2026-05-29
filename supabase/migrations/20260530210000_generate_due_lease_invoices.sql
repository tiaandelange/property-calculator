-- Automatic rent invoice generation from active leases.
-- Settings: platform defaults (admin) + per-profile overrides (landlord).

ALTER TABLE public.portfolio_projection_defaults
  ADD COLUMN IF NOT EXISTS rent_invoice_days_before_due integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS rent_invoice_grace_period_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.portfolio_projection_defaults
  ADD CONSTRAINT portfolio_projection_defaults_rent_invoice_days_before_due_check
    CHECK (rent_invoice_days_before_due >= 0 AND rent_invoice_days_before_due <= 28),
  ADD CONSTRAINT portfolio_projection_defaults_rent_invoice_grace_period_days_check
    CHECK (rent_invoice_grace_period_days >= 0 AND rent_invoice_grace_period_days <= 31);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rent_invoice_days_before_due integer,
  ADD COLUMN IF NOT EXISTS rent_invoice_grace_period_days integer;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rent_invoice_days_before_due_check
    CHECK (rent_invoice_days_before_due IS NULL OR (rent_invoice_days_before_due >= 0 AND rent_invoice_days_before_due <= 28)),
  ADD CONSTRAINT profiles_rent_invoice_grace_period_days_check
    CHECK (rent_invoice_grace_period_days IS NULL OR (rent_invoice_grace_period_days >= 0 AND rent_invoice_grace_period_days <= 31));

COMMENT ON COLUMN public.portfolio_projection_defaults.rent_invoice_days_before_due IS
  'Platform default: create rent invoices this many calendar days before lease rent_due_day.';
COMMENT ON COLUMN public.portfolio_projection_defaults.rent_invoice_grace_period_days IS
  'Platform default: days after due date before an unpaid invoice is treated as overdue (UI/RPC; generation still catch-up safe).';
COMMENT ON COLUMN public.profiles.rent_invoice_days_before_due IS
  'Landlord override for days-before-due; NULL uses portfolio_projection_defaults.';
COMMENT ON COLUMN public.profiles.rent_invoice_grace_period_days IS
  'Landlord override for post-due grace days; NULL uses portfolio_projection_defaults.';

-- ---------------------------------------------------------------------------
-- Date helpers (Africa/Johannesburg — consistent business calendar)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_business_timezone ()
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT 'Africa/Johannesburg';
$$;

CREATE OR REPLACE FUNCTION public.app_business_date (p_ts timestamptz DEFAULT now())
  RETURNS date
  LANGUAGE sql
  STABLE
  AS $$
  SELECT (coalesce(p_ts, now()) AT TIME ZONE public.app_business_timezone())::date;
$$;

CREATE OR REPLACE FUNCTION public.lease_rent_due_date (p_year integer, p_month integer, p_rent_due_day integer)
  RETURNS date
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  v_dom integer;
  v_last_dom integer;
BEGIN
  v_dom := LEAST(GREATEST(coalesce(p_rent_due_day, 1), 1), 31);
  v_last_dom := EXTRACT(DAY FROM (
    (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
  ))::integer;
  v_dom := LEAST(v_dom, v_last_dom);
  RETURN make_date(p_year, p_month, v_dom);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_rent_invoice_settings (p_user_id uuid)
  RETURNS TABLE (days_before_due integer, grace_period_days integer)
  LANGUAGE sql
  STABLE
  AS $$
  SELECT
    coalesce(
      p.rent_invoice_days_before_due,
      d.rent_invoice_days_before_due,
      10
    )::integer,
    coalesce(
      p.rent_invoice_grace_period_days,
      d.rent_invoice_grace_period_days,
      7
    )::integer
  FROM public.profiles p
  CROSS JOIN (
    SELECT
      rent_invoice_days_before_due,
      rent_invoice_grace_period_days
    FROM public.portfolio_projection_defaults
    ORDER BY created_at ASC
    LIMIT 1
  ) d
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.lease_is_invoice_eligible (p_lease public.leases, p_as_of date)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  AS $$
DECLARE
  v_display_status text;
BEGIN
  IF p_lease.cancellation_date IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  IF p_lease.status IN (
    'CANCELLED'::public.app_lease_status,
    'TERMINATED'::public.app_lease_status,
    'EXPIRED'::public.app_lease_status,
    'ARCHIVED'::public.app_lease_status,
    'DRAFT'::public.app_lease_status
  ) THEN
    RETURN FALSE;
  END IF;
  v_display_status := p_lease.status::text;
  IF p_lease.status = 'ACTIVE'::public.app_lease_status
    AND p_lease.fixed_term_end_date IS NOT NULL
    AND p_lease.fixed_term_end_date::date < p_as_of THEN
    v_display_status := 'MONTH_TO_MONTH';
  END IF;
  RETURN v_display_status IN ('ACTIVE', 'MONTH_TO_MONTH');
END;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent rent invoice generation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_due_lease_invoices (p_as_of date DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_uid uuid := auth.uid();
  v_today date;
  v_lease public.leases %ROWTYPE;
  v_days_before integer;
  v_grace integer;
  v_checked integer := 0;
  v_created integer := 0;
  v_skipped_dup integer := 0;
  v_skipped_inactive integer := 0;
  v_skipped_not_due integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_offset integer;
  v_anchor date;
  v_year integer;
  v_month integer;
  v_due_date date;
  v_gen_date date;
  v_period text;
  v_inv_id uuid;
  v_num text;
  v_desc text;
  v_due_ts timestamptz;
  v_issue_ts timestamptz;
  v_rent double precision;
  v_err text;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' AND v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_today := coalesce(p_as_of, public.app_business_date());

  FOR v_lease IN
    SELECT l.*
    FROM public.leases l
    WHERE v_role = 'service_role'
      OR l.user_id = v_uid
    ORDER BY l.id
  LOOP
    v_checked := v_checked + 1;

    BEGIN
      IF NOT public.lease_is_invoice_eligible(v_lease, v_today) THEN
        v_skipped_inactive := v_skipped_inactive + 1;
        CONTINUE;
      END IF;

      SELECT s.days_before_due, s.grace_period_days
      INTO v_days_before, v_grace
      FROM public.resolve_rent_invoice_settings(v_lease.user_id) s;

      v_rent := v_lease.monthly_rent;
      IF v_rent IS NULL OR v_rent < 0 THEN
        RAISE EXCEPTION 'INVALID_LEASE_RENT';
      END IF;

      FOR v_offset IN -1..1 LOOP
        v_anchor := (date_trunc('month', v_today::timestamp)::date + (v_offset || ' months')::interval)::date;
        v_year := EXTRACT(YEAR FROM v_anchor)::integer;
        v_month := EXTRACT(MONTH FROM v_anchor)::integer;
        v_due_date := public.lease_rent_due_date(v_year, v_month, v_lease.rent_due_day);
        v_gen_date := v_due_date - v_days_before;
        v_period := to_char(v_due_date, 'YYYY-MM');

        IF v_today < v_gen_date THEN
          v_skipped_not_due := v_skipped_not_due + 1;
          CONTINUE;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM public.invoices i
          WHERE i.lease_id = v_lease.id
            AND i.invoice_type = 'RENT'::public.app_invoice_type
            AND i.invoice_period = v_period
            AND i.status NOT IN (
              'CANCELLED'::public.app_invoice_status,
              'VOID'::public.app_invoice_status
            )
        ) THEN
          v_skipped_dup := v_skipped_dup + 1;
          CONTINUE;
        END IF;

        v_num := public.generate_invoice_number();
        v_desc := 'Monthly Rent — ' || v_period;
        v_due_ts := (v_due_date::text || 'T12:00:00+00')::timestamptz;
        v_issue_ts := (v_today::text || 'T12:00:00+00')::timestamptz;

        INSERT INTO public.invoices (
          user_id,
          property_id,
          tenant_id,
          lease_id,
          unit_id,
          invoice_number,
          invoice_type,
          invoice_period,
          invoice_date,
          issue_date,
          due_date,
          status,
          subtotal,
          tax_amount,
          total,
          total_amount,
          balance_due,
          notes
        )
        VALUES (
          v_lease.user_id,
          v_lease.property_id,
          v_lease.tenant_id,
          v_lease.id,
          v_lease.unit_id,
          v_num,
          'RENT'::public.app_invoice_type,
          v_period,
          v_issue_ts,
          v_issue_ts,
          v_due_ts,
          'GENERATED'::public.app_invoice_status,
          v_rent,
          0,
          v_rent,
          v_rent,
          v_rent,
          NULL
        )
        RETURNING id INTO v_inv_id;

        INSERT INTO public.invoice_line_items (
          invoice_id,
          description,
          category,
          quantity,
          unit_price,
          total,
          sort_order
        )
        VALUES (
          v_inv_id,
          v_desc,
          'RENT'::public.app_property_income_category,
          1,
          v_rent,
          v_rent,
          1
        );

        v_created := v_created + 1;
      END LOOP;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped_dup := v_skipped_dup + 1;
      WHEN OTHERS THEN
        v_err := SQLERRM;
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'lease_id', v_lease.id::text,
            'property_id', v_lease.property_id::text,
            'message', v_err
          )
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'leases_checked', v_checked,
    'invoices_created', v_created,
    'skipped_duplicate', v_skipped_dup,
    'skipped_inactive', v_skipped_inactive,
    'skipped_not_due', v_skipped_not_due,
    'errors', v_errors,
    'as_of_date', v_today::text,
    'timezone', public.app_business_timezone()
  );
END;
$$;

COMMENT ON FUNCTION public.generate_due_lease_invoices (date) IS
  'Creates GENERATED rent invoices for eligible active leases when business date >= due_date - days_before. Idempotent per lease+period. service_role = all landlords; authenticated = own leases.';

REVOKE ALL ON FUNCTION public.generate_due_lease_invoices (date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date) TO service_role;

-- Profile invoice automation settings (landlord override)
CREATE OR REPLACE FUNCTION public.update_profile_invoice_automation_settings (p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer;
  v_grace integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_payload ? 'rentInvoiceDaysBeforeDue' OR p_payload ? 'rent_invoice_days_before_due' THEN
    v_days := coalesce(
      (p_payload ->> 'rentInvoiceDaysBeforeDue')::integer,
      (p_payload ->> 'rent_invoice_days_before_due')::integer
    );
    IF v_days < 0 OR v_days > 28 THEN
      RAISE EXCEPTION 'INVALID_DAYS_BEFORE_DUE';
    END IF;
    UPDATE public.profiles
    SET rent_invoice_days_before_due = v_days, updated_at = now()
    WHERE id = v_uid;
  END IF;

  IF p_payload ? 'rentInvoiceGracePeriodDays' OR p_payload ? 'rent_invoice_grace_period_days' THEN
    v_grace := coalesce(
      (p_payload ->> 'rentInvoiceGracePeriodDays')::integer,
      (p_payload ->> 'rent_invoice_grace_period_days')::integer
    );
    IF v_grace < 0 OR v_grace > 31 THEN
      RAISE EXCEPTION 'INVALID_GRACE_PERIOD';
    END IF;
    UPDATE public.profiles
    SET rent_invoice_grace_period_days = v_grace, updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'rentInvoiceDaysBeforeDue', coalesce(s.days_before_due, 10),
      'rentInvoiceGracePeriodDays', coalesce(s.grace_period_days, 7)
    )
    FROM public.resolve_rent_invoice_settings(v_uid) s
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_invoice_automation_settings (jsonb) TO authenticated;

-- Admin: platform defaults + optional manual sync trigger
CREATE OR REPLACE FUNCTION public.update_platform_invoice_automation_defaults (p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.portfolio_projection_defaults %ROWTYPE;
  v_days integer;
  v_grace integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND p.role = 'ADMIN'::public.app_user_role
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_row
  FROM public.portfolio_projection_defaults
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEFAULTS_NOT_FOUND';
  END IF;

  IF p_payload ? 'rentInvoiceDaysBeforeDue' OR p_payload ? 'rent_invoice_days_before_due' THEN
    v_days := coalesce(
      (p_payload ->> 'rentInvoiceDaysBeforeDue')::integer,
      (p_payload ->> 'rent_invoice_days_before_due')::integer
    );
    IF v_days < 0 OR v_days > 28 THEN
      RAISE EXCEPTION 'INVALID_DAYS_BEFORE_DUE';
    END IF;
    UPDATE public.portfolio_projection_defaults
    SET rent_invoice_days_before_due = v_days, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  IF p_payload ? 'rentInvoiceGracePeriodDays' OR p_payload ? 'rent_invoice_grace_period_days' THEN
    v_grace := coalesce(
      (p_payload ->> 'rentInvoiceGracePeriodDays')::integer,
      (p_payload ->> 'rent_invoice_grace_period_days')::integer
    );
    IF v_grace < 0 OR v_grace > 31 THEN
      RAISE EXCEPTION 'INVALID_GRACE_PERIOD';
    END IF;
    UPDATE public.portfolio_projection_defaults
    SET rent_invoice_grace_period_days = v_grace, updated_at = now()
    WHERE id = v_row.id;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'rentInvoiceDaysBeforeDue', rent_invoice_days_before_due,
      'rentInvoiceGracePeriodDays', rent_invoice_grace_period_days
    )
    FROM public.portfolio_projection_defaults
    WHERE id = v_row.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_platform_invoice_automation_defaults (jsonb) TO authenticated;
