-- Special operations: invoice from lease, financial historical backfill (SPA cutover from Express).

CREATE OR REPLACE FUNCTION public.create_invoice_from_lease (
  p_property_id uuid,
  p_lease_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease public.leases %ROWTYPE;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_dup uuid;
  v_inv_id uuid;
  v_num text;
  v_due_dom int;
  v_due_ts timestamptz;
  v_display_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.id = p_property_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_OWNED';
  END IF;

  IF p_lease_id IS NOT NULL THEN
    SELECT * INTO v_lease FROM public.leases l
    WHERE l.id = p_lease_id AND l.property_id = p_property_id AND l.user_id = v_uid;
  ELSE
    SELECT * INTO v_lease FROM public.leases l
    WHERE l.property_id = p_property_id AND l.user_id = v_uid
    ORDER BY l.created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEASE_NOT_FOUND';
  END IF;

  v_display_status := v_lease.status::text;
  IF v_lease.status = 'ACTIVE'::public.app_lease_status
    AND v_lease.fixed_term_end_date IS NOT NULL
    AND v_lease.fixed_term_end_date < (now() AT TIME ZONE 'UTC')::date THEN
    v_display_status := 'MONTH_TO_MONTH';
  END IF;

  IF v_display_status NOT IN ('ACTIVE', 'MONTH_TO_MONTH') THEN
    RAISE EXCEPTION 'LEASE_NOT_ACTIVE';
  END IF;

  v_month_start := date_trunc('month', (now() AT TIME ZONE 'UTC'))::timestamptz;
  v_month_end := v_month_start + interval '1 month';

  SELECT i.id INTO v_dup FROM public.invoices i
  WHERE i.user_id = v_uid
    AND i.property_id = p_property_id
    AND i.lease_id = v_lease.id
    AND i.invoice_date >= v_month_start
    AND i.invoice_date < v_month_end
    AND i.status IS DISTINCT FROM 'CANCELLED'::public.app_invoice_status
  LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'An invoice already exists for this lease in this calendar month.',
      'invoiceId', v_dup::text
    );
  END IF;

  v_num := public.generate_invoice_number();
  v_due_dom := LEAST(GREATEST(COALESCE(v_lease.rent_due_day, 1), 1), 28);
  v_due_ts := (
    make_date(
      EXTRACT(YEAR FROM (now() AT TIME ZONE 'UTC'))::int,
      EXTRACT(MONTH FROM (now() AT TIME ZONE 'UTC'))::int,
      v_due_dom
    )::text || 'T12:00:00+00'
  )::timestamptz;

  INSERT INTO public.invoices (
    user_id, property_id, tenant_id, lease_id,
    invoice_number, invoice_date, due_date, status,
    subtotal, total, notes
  )
  VALUES (
    v_uid, p_property_id, v_lease.tenant_id, v_lease.id,
    v_num, v_month_start, v_due_ts, 'DRAFT'::public.app_invoice_status,
    v_lease.monthly_rent, v_lease.monthly_rent, NULL
  )
  RETURNING id INTO v_inv_id;

  INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, total)
  VALUES (v_inv_id, 'Monthly rent', 1, v_lease.monthly_rent, v_lease.monthly_rent);

  RETURN jsonb_build_object('ok', true, 'invoiceId', v_inv_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_from_lease (uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_lease (uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.create_invoice_from_lease (uuid, uuid) IS
  'Draft invoice for active lease in current UTC month; idempotent per lease+month.';

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.run_financial_historical_backfill (
  p_property_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_start_ym text;
  v_end_ym text;
  v_monthly_income double precision;
  v_monthly_expenses double precision;
  v_status public.app_property_income_status;
  v_include_bond boolean;
  v_bond_amount double precision;
  v_notes text;
  v_ym text;
  v_y int;
  v_m int;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_income_created int := 0;
  v_expense_created int := 0;
  v_skipped int := 0;
  v_elem jsonb;
  v_cat text;
  v_amt double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.id = p_property_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_OWNED';
  END IF;

  v_start_ym := trim(coalesce(p_payload->>'startMonth', ''));
  v_end_ym := trim(coalesce(p_payload->>'endMonth', ''));
  IF v_start_ym !~ '^\d{4}-\d{2}$' OR v_end_ym !~ '^\d{4}-\d{2}$' OR v_start_ym > v_end_ym THEN
    RAISE EXCEPTION 'INVALID_MONTH_RANGE';
  END IF;

  v_monthly_income := coalesce((p_payload->>'monthlyIncome')::double precision, 0);
  v_monthly_expenses := coalesce((p_payload->>'monthlyExpenses')::double precision, 0);
  v_status := coalesce(
    (p_payload->>'status')::public.app_property_income_status,
    'EXPECTED'::public.app_property_income_status
  );
  v_include_bond := coalesce((p_payload->>'includeBondPayment')::boolean, false);
  v_bond_amount := coalesce((p_payload->>'bondAmount')::double precision, 0);
  v_notes := nullif(trim(coalesce(p_payload->>'notes', '')), '');

  v_ym := v_start_ym;
  WHILE v_ym <= v_end_ym LOOP
    v_y := substring(v_ym from 1 for 4)::int;
    v_m := substring(v_ym from 6 for 2)::int;
    v_month_start := make_timestamptz(v_y, v_m, 1, 0, 0, 0, 'UTC');
    v_month_end := v_month_start + interval '1 month';

    IF v_monthly_income > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.income_entries ie
        WHERE ie.user_id = v_uid AND ie.property_id = p_property_id
          AND ie.category = 'RENT' AND ie.source = 'HISTORICAL_BACKFILL'::public.app_property_income_source
          AND ie.income_date >= v_month_start AND ie.income_date < v_month_end) THEN
        INSERT INTO public.income_entries (
          user_id, property_id, category, description, amount, income_date, source, status
        )
        VALUES (
          v_uid, p_property_id, 'RENT',
          'Historical backfill ' || v_ym || coalesce(' — ' || v_notes, ''),
          v_monthly_income,
          make_timestamptz(v_y, v_m, 1, 12, 0, 0, 'UTC'),
          'HISTORICAL_BACKFILL'::public.app_property_income_source,
          v_status
        );
        v_income_created := v_income_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;

    IF jsonb_array_length(coalesce(p_payload->'expenseBreakdown', '[]'::jsonb)) > 0 THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'expenseBreakdown') LOOP
        v_cat := coalesce(v_elem->>'category', 'OTHER');
        v_amt := coalesce((v_elem->>'amount')::double precision, 0);
        IF v_amt <= 0 THEN
          CONTINUE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM public.expense_entries ee
          WHERE ee.user_id = v_uid AND ee.property_id = p_property_id
            AND ee.category = v_cat::public.app_property_expense_category
            AND ee.source = 'HISTORICAL_BACKFILL'::public.app_property_expense_source
            AND ee.expense_date >= v_month_start AND ee.expense_date < v_month_end) THEN
          INSERT INTO public.expense_entries (
            user_id, property_id, category, description, amount, expense_date,
            is_recurring, source, status
          )
          VALUES (
            v_uid, p_property_id, v_cat::public.app_property_expense_category,
            'Historical backfill ' || v_ym || coalesce(' — ' || v_notes, ''),
            v_amt, make_timestamptz(v_y, v_m, 5, 12, 0, 0, 'UTC'),
            false, 'HISTORICAL_BACKFILL'::public.app_property_expense_source,
            'ACTIVE'::public.app_property_expense_status
          );
          v_expense_created := v_expense_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END LOOP;
    ELSIF v_monthly_expenses > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.expense_entries ee
        WHERE ee.user_id = v_uid AND ee.property_id = p_property_id
          AND ee.category = 'OTHER'::public.app_property_expense_category
          AND ee.source = 'HISTORICAL_BACKFILL'::public.app_property_expense_source
          AND ee.expense_date >= v_month_start AND ee.expense_date < v_month_end) THEN
        INSERT INTO public.expense_entries (
          user_id, property_id, category, description, amount, expense_date,
          is_recurring, source, status
        )
        VALUES (
          v_uid, p_property_id, 'OTHER'::public.app_property_expense_category,
          'Historical backfill ' || v_ym || coalesce(' — ' || v_notes, ''),
          v_monthly_expenses, make_timestamptz(v_y, v_m, 5, 12, 0, 0, 'UTC'),
          false, 'HISTORICAL_BACKFILL'::public.app_property_expense_source,
          'ACTIVE'::public.app_property_expense_status
        );
        v_expense_created := v_expense_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;

    IF v_include_bond AND v_bond_amount > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.expense_entries ee
        WHERE ee.user_id = v_uid AND ee.property_id = p_property_id
          AND ee.category = 'BOND_PAYMENT'::public.app_property_expense_category
          AND ee.source = 'HISTORICAL_BACKFILL'::public.app_property_expense_source
          AND ee.expense_date >= v_month_start AND ee.expense_date < v_month_end) THEN
        INSERT INTO public.expense_entries (
          user_id, property_id, category, description, amount, expense_date,
          is_recurring, source, status
        )
        VALUES (
          v_uid, p_property_id, 'BOND_PAYMENT'::public.app_property_expense_category,
          'Historical bond payment ' || v_ym || coalesce(' — ' || v_notes, ''),
          v_bond_amount, make_timestamptz(v_y, v_m, 7, 12, 0, 0, 'UTC'),
          false, 'HISTORICAL_BACKFILL'::public.app_property_expense_source,
          'ACTIVE'::public.app_property_expense_status
        );
        v_expense_created := v_expense_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;

    v_m := v_m + 1;
    IF v_m > 12 THEN
      v_m := 1;
      v_y := v_y + 1;
    END IF;
    v_ym := v_y::text || '-' || lpad(v_m::text, 2, '0');
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'monthsProcessed', (
      (substring(v_end_ym from 1 for 4)::int - substring(v_start_ym from 1 for 4)::int) * 12
      + (substring(v_end_ym from 6 for 2)::int - substring(v_start_ym from 6 for 2)::int)
      + 1
    ),
    'incomeEntriesCreated', v_income_created,
    'expenseEntriesCreated', v_expense_created,
    'skippedDuplicates', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_financial_historical_backfill (uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_financial_historical_backfill (uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.run_financial_historical_backfill (uuid, jsonb) IS
  'Bulk historical income/expense rows per calendar month; skips duplicate HISTORICAL_BACKFILL rows in each month.';
