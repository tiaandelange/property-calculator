-- Rent invoice generation: respect lease start/end dates and generation window.
-- Prevents May/June invoices for leases that only start in July.

CREATE OR REPLACE FUNCTION public.lease_date_only (p_ts timestamptz)
  RETURNS date
  LANGUAGE sql
  STABLE
  AS $$
  SELECT (coalesce(p_ts, now()) AT TIME ZONE public.app_business_timezone())::date;
$$;

COMMENT ON FUNCTION public.lease_date_only (timestamptz) IS
  'Calendar date for a lease timestamp in the app business timezone (Africa/Johannesburg).';

CREATE OR REPLACE FUNCTION public.lease_rent_due_in_billing_period (
  p_lease public.leases,
  p_due_date date
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  AS $$
DECLARE
  v_lease_start date;
  v_lease_end date;
  v_display text;
BEGIN
  IF p_due_date IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_lease.start_date IS NOT NULL THEN
    v_lease_start := public.lease_date_only(p_lease.start_date);
    IF p_due_date < v_lease_start THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_lease.cancellation_date IS NOT NULL THEN
    IF p_due_date > public.lease_date_only(p_lease.cancellation_date) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_lease.fixed_term_end_date IS NOT NULL THEN
    v_lease_end := public.lease_date_only(p_lease.fixed_term_end_date);
    IF p_due_date > v_lease_end THEN
      v_display := public.lease_display_status(
        p_lease.status::text,
        v_lease_end,
        public.lease_date_only(p_lease.cancellation_date)
      );
      IF v_display <> 'MONTH_TO_MONTH' THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.lease_rent_due_in_billing_period (public.leases, date) IS
  'True when a rent due date falls within the lease billing window (on/after start, on/before end/cancellation; month-to-month continues after fixed term).';

DROP FUNCTION IF EXISTS public.generate_due_lease_invoices (date);

CREATE OR REPLACE FUNCTION public.generate_due_lease_invoices (
  p_as_of date DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
)
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
  v_auto_generate boolean;
  v_checked integer := 0;
  v_created integer := 0;
  v_skipped_dup integer := 0;
  v_skipped_inactive integer := 0;
  v_skipped_not_due integer := 0;
  v_skipped_auto_off integer := 0;
  v_skipped_outside_lease integer := 0;
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
  v_last_user_id uuid := NULL;
  v_last_auto boolean := true;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' AND v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_today := coalesce(p_as_of, public.app_business_date());

  FOR v_lease IN
    SELECT l.*
    FROM public.leases l
    WHERE (
        v_role = 'service_role'
        OR l.user_id = v_uid
      )
      AND (
        p_property_id IS NULL
        OR l.property_id = p_property_id
      )
    ORDER BY l.user_id, l.id
  LOOP
    v_checked := v_checked + 1;

    BEGIN
      IF v_lease.user_id IS DISTINCT FROM v_last_user_id THEN
        SELECT s.days_before_due, s.grace_period_days, s.auto_generate
        INTO v_days_before, v_grace, v_auto_generate
        FROM public.resolve_rent_invoice_settings(v_lease.user_id) s;
        v_last_user_id := v_lease.user_id;
        v_last_auto := coalesce(v_auto_generate, true);
      END IF;

      IF NOT v_last_auto THEN
        v_skipped_auto_off := v_skipped_auto_off + 1;
        CONTINUE;
      END IF;

      IF NOT public.lease_is_invoice_eligible(v_lease, v_today) THEN
        v_skipped_inactive := v_skipped_inactive + 1;
        CONTINUE;
      END IF;

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

        IF NOT public.lease_rent_due_in_billing_period(v_lease, v_due_date) THEN
          v_skipped_outside_lease := v_skipped_outside_lease + 1;
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
    'skipped_outside_lease', v_skipped_outside_lease,
    'skipped_auto_disabled', v_skipped_auto_off,
    'errors', v_errors,
    'as_of_date', v_today::text,
    'timezone', public.app_business_timezone(),
    'property_id', CASE WHEN p_property_id IS NULL THEN NULL ELSE p_property_id::text END
  );
END;
$$;

COMMENT ON FUNCTION public.generate_due_lease_invoices (date, uuid) IS
  'Creates GENERATED rent invoices when business date >= due_date - days_before and due date is within lease billing window. Idempotent per lease+period. Optional property scope.';

REVOKE ALL ON FUNCTION public.generate_due_lease_invoices (date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date, uuid) TO service_role;

-- Manual generation: reject periods outside lease billing window.
CREATE OR REPLACE FUNCTION public.manual_generate_lease_invoice (
  p_lease_id uuid,
  p_invoice_period text,
  p_invoice_type public.app_invoice_type DEFAULT 'RENT'::public.app_invoice_type,
  p_due_date date DEFAULT NULL,
  p_amount double precision DEFAULT NULL,
  p_notes text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lease public.leases %ROWTYPE;
  v_dup uuid;
  v_inv_id uuid;
  v_num text;
  v_period text;
  v_due_date date;
  v_due_ts timestamptz;
  v_issue_ts timestamptz;
  v_amount double precision;
  v_year integer;
  v_month integer;
  v_display_status text;
  v_line_desc text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_lease_id IS NULL THEN
    RAISE EXCEPTION 'LEASE_ID_REQUIRED';
  END IF;

  v_period := trim(coalesce(p_invoice_period, ''));
  IF v_period !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'INVALID_INVOICE_PERIOD';
  END IF;

  SELECT * INTO v_lease
  FROM public.leases l
  WHERE l.id = p_lease_id
    AND l.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEASE_NOT_FOUND';
  END IF;

  v_display_status := v_lease.status::text;
  IF v_lease.status = 'ACTIVE'::public.app_lease_status
    AND v_lease.fixed_term_end_date IS NOT NULL
    AND v_lease.fixed_term_end_date < public.app_business_date() THEN
    v_display_status := 'MONTH_TO_MONTH';
  END IF;

  IF v_display_status NOT IN ('ACTIVE', 'MONTH_TO_MONTH') THEN
    RAISE EXCEPTION 'LEASE_NOT_ACTIVE';
  END IF;

  IF v_lease.tenant_id IS NULL THEN
    RAISE EXCEPTION 'LEASE_MISSING_TENANT';
  END IF;

  v_amount := coalesce(p_amount, v_lease.monthly_rent);
  IF v_amount IS NULL OR v_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  v_year := split_part(v_period, '-', 1)::integer;
  v_month := split_part(v_period, '-', 2)::integer;

  v_due_date := coalesce(
    p_due_date,
    public.lease_rent_due_date(v_year, v_month, v_lease.rent_due_day)
  );

  IF NOT public.lease_rent_due_in_billing_period(v_lease, v_due_date) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Invoice period is outside the lease billing window (before lease start or after lease end).',
      'invoiceId', NULL,
      'tenantId', v_lease.tenant_id::text,
      'propertyId', v_lease.property_id::text
    );
  END IF;

  SELECT i.id INTO v_dup
  FROM public.invoices i
  WHERE i.user_id = v_uid
    AND i.lease_id = v_lease.id
    AND i.invoice_type = p_invoice_type
    AND i.invoice_period = v_period
    AND i.status NOT IN (
      'CANCELLED'::public.app_invoice_status,
      'VOID'::public.app_invoice_status
    )
  LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'duplicate', true,
      'message', 'An invoice already exists for this lease and period.',
      'invoiceId', v_dup::text,
      'tenantId', v_lease.tenant_id::text,
      'propertyId', v_lease.property_id::text
    );
  END IF;

  v_num := public.generate_invoice_number();
  v_due_ts := (v_due_date::text || 'T12:00:00+00')::timestamptz;
  v_issue_ts := (public.app_business_date()::text || 'T12:00:00+00')::timestamptz;

  v_line_desc := CASE
    WHEN p_invoice_type = 'RENT'::public.app_invoice_type THEN 'Monthly Rent — ' || v_period
    ELSE coalesce(nullif(trim(p_notes), ''), 'Invoice line')
  END;

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
    v_uid,
    v_lease.property_id,
    v_lease.tenant_id,
    v_lease.id,
    v_lease.unit_id,
    v_num,
    p_invoice_type,
    v_period,
    v_issue_ts,
    v_issue_ts,
    v_due_ts,
    'GENERATED'::public.app_invoice_status,
    v_amount,
    0,
    v_amount,
    v_amount,
    v_amount,
    nullif(trim(coalesce(p_notes, '')), '')
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
    v_line_desc,
    CASE
      WHEN p_invoice_type = 'UTILITY_RECOVERY'::public.app_invoice_type
        THEN 'UTILITIES_RECOVERY'::public.app_property_income_category
      WHEN p_invoice_type = 'RENT'::public.app_invoice_type
        THEN 'RENT'::public.app_property_income_category
      ELSE 'OTHER'::public.app_property_income_category
    END,
    1,
    v_amount,
    v_amount,
    1
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invoiceId', v_inv_id::text,
    'tenantId', v_lease.tenant_id::text,
    'propertyId', v_lease.property_id::text
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT i.id INTO v_dup
    FROM public.invoices i
    WHERE i.lease_id = v_lease.id
      AND i.invoice_type = p_invoice_type
      AND i.invoice_period = v_period
      AND i.status NOT IN (
        'CANCELLED'::public.app_invoice_status,
        'VOID'::public.app_invoice_status
      )
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', false,
      'duplicate', true,
      'message', 'An invoice already exists for this lease and period.',
      'invoiceId', coalesce(v_dup::text, ''),
      'tenantId', v_lease.tenant_id::text,
      'propertyId', v_lease.property_id::text
    );
END;
$$;

-- Diagnostic: suspicious rent invoices for cleanup review.
CREATE OR REPLACE FUNCTION public.audit_suspicious_rent_invoices (p_property_id uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(row_data ORDER BY row_data ->> 'dueDate', row_data ->> 'invoicePeriod')
      FROM (
        SELECT jsonb_build_object(
          'invoiceId', i.id::text,
          'invoiceNumber', i.invoice_number,
          'invoicePeriod', i.invoice_period,
          'dueDate', (i.due_date AT TIME ZONE public.app_business_timezone())::date::text,
          'status', i.status::text,
          'leaseId', l.id::text,
          'leaseStartDate', public.lease_date_only(l.start_date)::text,
          'leaseEndDate', CASE
            WHEN l.fixed_term_end_date IS NULL THEN NULL
            ELSE public.lease_date_only(l.fixed_term_end_date)::text
          END,
          'tenantName', btrim(concat_ws(' ', tn.first_name, tn.last_name)),
          'reasons', array_remove(ARRAY[
            CASE
              WHEN l.start_date IS NOT NULL
                AND (i.due_date AT TIME ZONE public.app_business_timezone())::date < public.lease_date_only(l.start_date) THEN
                'due_date_before_lease_start'
              ELSE NULL
            END,
            CASE
              WHEN NOT public.lease_rent_due_in_billing_period(l, (i.due_date AT TIME ZONE public.app_business_timezone())::date) THEN
                'outside_lease_billing_window'
              ELSE NULL
            END,
            CASE
              WHEN NOT public.lease_is_invoice_eligible(l, public.app_business_date()) THEN
                'lease_not_invoice_eligible'
              ELSE NULL
            END,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM public.invoices i2
                WHERE i2.lease_id = i.lease_id
                  AND i2.invoice_type = 'RENT'::public.app_invoice_type
                  AND i2.invoice_period = i.invoice_period
                  AND i2.id <> i.id
                  AND i2.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
              ) THEN
                'duplicate_period_for_lease'
              ELSE NULL
            END
          ], NULL)
        ) AS row_data
        FROM public.invoices i
        INNER JOIN public.leases l ON l.id = i.lease_id
        LEFT JOIN public.tenants tn ON tn.id = i.tenant_id
        WHERE i.user_id = v_uid
          AND i.invoice_type = 'RENT'::public.app_invoice_type
          AND i.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
          AND (p_property_id IS NULL OR i.property_id = p_property_id)
      ) s
      WHERE cardinality(s.row_data -> 'reasons') > 0
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.audit_suspicious_rent_invoices (uuid) IS
  'Lists rent invoices that may be invalid (before lease start, outside billing window, inactive lease, or duplicate period).';

GRANT EXECUTE ON FUNCTION public.audit_suspicious_rent_invoices (uuid) TO authenticated;
