-- Rent invoice catch-up: richer descriptions, timezone-safe eligibility, audit helper.

CREATE OR REPLACE FUNCTION public.lease_is_invoice_eligible (p_lease public.leases, p_as_of date)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  AS $$
DECLARE
  v_display_status text;
  v_cancel date;
BEGIN
  IF p_lease.cancellation_date IS NOT NULL THEN
    v_cancel := public.lease_date_only(p_lease.cancellation_date);
    IF v_cancel <= p_as_of THEN
      RETURN FALSE;
    END IF;
  END IF;

  v_display_status := public.lease_display_status(
    p_lease.status::text,
    CASE
      WHEN p_lease.fixed_term_end_date IS NULL THEN NULL
      ELSE public.lease_date_only(p_lease.fixed_term_end_date)
    END,
    v_cancel
  );

  IF NOT public.is_current_lease_status(v_display_status) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.lease_is_invoice_eligible (public.leases, date) IS
  'True when lease is active/month-to-month on p_as_of and not past cancellation (business-date safe).';

CREATE OR REPLACE FUNCTION public.rent_invoice_line_description (
  p_period text,
  p_tenant_first text,
  p_tenant_last text,
  p_unit_name text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    'Monthly Rent — '
    || nullif(
      btrim(concat_ws(' ', nullif(btrim(coalesce(p_tenant_first, '')), ''), nullif(btrim(coalesce(p_tenant_last, '')), ''))),
      ''
    )
    || CASE
      WHEN nullif(btrim(coalesce(p_unit_name, '')), '') IS NOT NULL THEN
        ' / ' || btrim(p_unit_name)
      ELSE ''
    END
    || ' — '
    || coalesce(nullif(btrim(p_period), ''), '—');
$$;

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
  v_tenant_first text;
  v_tenant_last text;
  v_unit_name text;
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

      SELECT tn.first_name, tn.last_name
      INTO v_tenant_first, v_tenant_last
      FROM public.tenants tn
      WHERE tn.id = v_lease.tenant_id;

      SELECT pu.unit_name
      INTO v_unit_name
      FROM public.property_units pu
      WHERE pu.id = v_lease.unit_id;

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
        v_desc := public.rent_invoice_line_description(
          v_period,
          v_tenant_first,
          v_tenant_last,
          v_unit_name
        );
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
    'statement_lines_created', v_created,
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
  'Idempotent rent invoice catch-up when business date >= due_date - days_before. Invoices appear on property statements via statement RPCs.';

CREATE OR REPLACE FUNCTION public.audit_missing_rent_invoices (p_property_id uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_business_date();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(row_data ORDER BY row_data ->> 'dueDate', row_data ->> 'leaseId')
      FROM (
        SELECT jsonb_build_object(
          'leaseId', l.id::text,
          'propertyId', l.property_id::text,
          'tenantName', btrim(concat_ws(' ', tn.first_name, tn.last_name)),
          'unitName', pu.unit_name,
          'rentDueDay', l.rent_due_day,
          'invoicePeriod', to_char(v_due.due_date, 'YYYY-MM'),
          'dueDate', v_due.due_date::text,
          'generationDate', (v_due.due_date - s.days_before_due)::text,
          'daysBeforeDue', s.days_before_due,
          'leaseStartDate', public.lease_date_only(l.start_date)::text,
          'leaseEndDate', CASE
            WHEN l.fixed_term_end_date IS NULL THEN NULL
            ELSE public.lease_date_only(l.fixed_term_end_date)::text
          END,
          'missingInvoice', NOT EXISTS (
            SELECT 1
            FROM public.invoices i
            WHERE i.lease_id = l.id
              AND i.invoice_type = 'RENT'::public.app_invoice_type
              AND i.invoice_period = to_char(v_due.due_date, 'YYYY-MM')
              AND i.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
          ),
          'inGenerationWindow', v_today >= (v_due.due_date - s.days_before_due),
          'eligible', public.lease_is_invoice_eligible(l, v_today)
            AND public.lease_rent_due_in_billing_period(l, v_due.due_date)
        ) AS row_data
        FROM public.leases l
        INNER JOIN public.properties p ON p.id = l.property_id AND p.user_id = v_uid
        LEFT JOIN public.tenants tn ON tn.id = l.tenant_id
        LEFT JOIN public.property_units pu ON pu.id = l.unit_id
        CROSS JOIN LATERAL public.resolve_rent_invoice_settings(l.user_id) s
        CROSS JOIN LATERAL (
          SELECT public.lease_rent_due_date(
            EXTRACT(YEAR FROM v_anchor)::integer,
            EXTRACT(MONTH FROM v_anchor)::integer,
            l.rent_due_day
          ) AS due_date
          FROM (
            SELECT (date_trunc('month', v_today::timestamp)::date + (v_off || ' months')::interval)::date AS v_anchor
            FROM generate_series(-1, 1) AS v_off
          ) anchors
        ) v_due
        WHERE l.user_id = v_uid
          AND coalesce(s.auto_generate, true)
          AND (p_property_id IS NULL OR l.property_id = p_property_id)
      ) audit_rows
      WHERE (audit_rows.row_data ->> 'missingInvoice')::boolean
        AND (audit_rows.row_data ->> 'inGenerationWindow')::boolean
        AND (audit_rows.row_data ->> 'eligible')::boolean
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.audit_missing_rent_invoices (uuid) IS
  'Lists eligible active leases missing a rent invoice for a due period currently in the generation window.';

GRANT EXECUTE ON FUNCTION public.audit_missing_rent_invoices (uuid) TO authenticated;
