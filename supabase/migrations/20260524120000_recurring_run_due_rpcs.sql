-- Run-due materialisation RPCs (Postgres-side). SECURITY DEFINER with explicit ownership checks.
-- Email / PDF / bond-aware expense materialisation remain on Express where noted.

CREATE OR REPLACE FUNCTION public.run_due_recurring_income ()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_uid uuid := auth.uid();
  r public.recurring_income_rules %ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_cal date := (v_now AT TIME ZONE 'UTC')::date;
  v_y int := EXTRACT(YEAR FROM v_cal)::int;
  v_m int := EXTRACT(MONTH FROM v_cal)::int;
  v_dom int;
  v_due_date date;
  v_due_ts timestamptz;
  v_new_id uuid;
  v_created int := 0;
  v_skipped_dup int := 0;
  v_skipped_schedule int := 0;
  v_skipped_frequency int := 0;
  v_ids jsonb := '[]'::jsonb;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'NOT_AUTHENTICATED';
    END IF;
  END IF;
  FOR r IN
    SELECT
      *
    FROM
      public.recurring_income_rules rir
    WHERE
      rir.status = 'ACTIVE'::public.app_recurring_income_rule_status
      AND rir.auto_create_expected_entries = TRUE
      AND (v_role = 'service_role'
        OR rir.user_id = v_uid)
    ORDER BY
      rir.id
    FOR UPDATE
      OF rir SKIP LOCKED
      LOOP
        IF r.frequency IS DISTINCT FROM 'MONTHLY'::public.app_recurring_frequency THEN
          v_skipped_frequency := v_skipped_frequency + 1;
          CONTINUE;
        END IF;
        v_dom := LEAST(GREATEST(COALESCE(r.day_of_month, 1), 1), 28);
        v_due_date := make_date(v_y, v_m, v_dom);
        v_due_ts := (v_due_date::text || 'T12:00:00+00')::timestamptz;
        IF v_due_ts > v_now THEN
          v_skipped_schedule := v_skipped_schedule + 1;
          CONTINUE;
        END IF;
        IF (r.start_date AT TIME ZONE 'UTC')::date > v_due_date THEN
          v_skipped_schedule := v_skipped_schedule + 1;
          CONTINUE;
        END IF;
        IF r.end_date IS NOT NULL AND v_due_date > (r.end_date AT TIME ZONE 'UTC')::date THEN
          v_skipped_schedule := v_skipped_schedule + 1;
          CONTINUE;
        END IF;
        IF EXISTS (
          SELECT
            1
          FROM
            public.income_entries ie
          WHERE
            ie.user_id = r.user_id
            AND ie.property_id = r.property_id
            AND ie.tenant_id = r.tenant_id
            AND ie.lease_id = r.lease_id
            AND ie.category = r.category
            AND ie.source = 'LEASE_EXPECTED'::public.app_property_income_source
            AND (ie.income_date AT TIME ZONE 'UTC')::date = v_due_date) THEN
          v_skipped_dup := v_skipped_dup + 1;
          CONTINUE;
        END IF;
        INSERT INTO public.income_entries (user_id, property_id, tenant_id, lease_id, category, description, amount, income_date, source, status)
          VALUES (r.user_id, r.property_id, r.tenant_id, r.lease_id, r.category, 'Expected rent', r.amount, v_due_ts, 'LEASE_EXPECTED'::public.app_property_income_source, 'EXPECTED'::public.app_property_income_status)
        RETURNING
          id INTO v_new_id;
        v_created := v_created + 1;
        v_ids := v_ids || jsonb_build_array(v_new_id);
      END LOOP;
  RETURN jsonb_build_object('created_count', v_created, 'skipped_duplicates', v_skipped_dup, 'skipped_schedule', v_skipped_schedule, 'skipped_non_monthly_frequency', v_skipped_frequency, 'income_entry_ids', v_ids, 'next_run_note', 'recurring_income_rules have no next_run_date column; idempotency is by existing LEASE_EXPECTED rows for the lease and calendar day (UTC).');
END;
$$;

COMMENT ON FUNCTION public.run_due_recurring_income () IS 'Creates at most one EXPECTED income row per active MONTHLY rule per call; scoped to auth.uid() unless JWT role is service_role.';

CREATE OR REPLACE FUNCTION public.run_due_recurring_invoices ()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_uid uuid := auth.uid();
  r public.recurring_invoice_rules %ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_cal date := (v_now AT TIME ZONE 'UTC')::date;
  v_y int := EXTRACT(YEAR FROM v_cal)::int;
  v_m int := EXTRACT(MONTH FROM v_cal)::int;
  v_last_dom int;
  v_dom_inv int;
  v_due_ts timestamptz;
  v_inv_id uuid;
  v_next timestamptz;
  v_created int := 0;
  v_skipped_frequency int := 0;
  v_ids jsonb := '[]'::jsonb;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'NOT_AUTHENTICATED';
    END IF;
  END IF;
  FOR r IN
    SELECT
      *
    FROM
      public.recurring_invoice_rules rir
    WHERE
      rir.enabled = TRUE
      AND rir.next_run_date <= v_now
      AND (v_role = 'service_role'
        OR rir.user_id = v_uid)
    ORDER BY
      rir.id
    FOR UPDATE
      OF rir SKIP LOCKED
      LOOP
        IF r.frequency IS DISTINCT FROM 'MONTHLY'::public.app_recurring_frequency THEN
          UPDATE
            public.recurring_invoice_rules
          SET
            next_run_date = r.next_run_date + interval '1 month',
            updated_at = clock_timestamp()
          WHERE
            id = r.id;
          v_skipped_frequency := v_skipped_frequency + 1;
          CONTINUE;
        END IF;
        v_last_dom := EXTRACT(DAY FROM ((date_trunc('month', make_date(v_y, v_m, 1)::timestamp) + interval '1 month - 1 day')::date))::int;
        v_dom_inv := LEAST(GREATEST(COALESCE(r.day_of_month, 1), 1), v_last_dom);
        v_due_ts := (make_date(v_y, v_m, v_dom_inv)::text || 'T12:00:00+00')::timestamptz;
        INSERT INTO public.invoices (user_id, property_id, tenant_id, lease_id, invoice_number, invoice_date, due_date, status, subtotal, total, notes)
          VALUES (r.user_id, r.property_id, r.tenant_id, r.lease_id, 'AUTO-' || REPLACE(gen_random_uuid()::text, '-', ''), v_now, v_due_ts, 'DRAFT'::public.app_invoice_status, r.rent_amount, r.rent_amount, 'Generated by recurring invoice rule (RPC)')
        RETURNING
          id INTO v_inv_id;
        INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, total)
          VALUES (v_inv_id, r.invoice_description, 1, r.rent_amount, r.rent_amount);
        v_next := r.next_run_date + interval '1 month';
        UPDATE
          public.recurring_invoice_rules
        SET
          next_run_date = v_next,
          updated_at = clock_timestamp()
        WHERE
          id = r.id;
        v_created := v_created + 1;
        v_ids := v_ids || jsonb_build_array(v_inv_id);
      END LOOP;
  RETURN jsonb_build_object('created_count', v_created, 'skipped_non_monthly_frequency', v_skipped_frequency, 'invoice_ids', v_ids, 'note', 'Tenant email / SENT status are not handled in SQL; use Express run-due if you rely on outbound email.');
END;
$$;

COMMENT ON FUNCTION public.run_due_recurring_invoices () IS 'One DRAFT invoice + line item per due MONTHLY rule; advances next_run_date by one month; auth.uid() scope unless service_role.';

CREATE OR REPLACE FUNCTION public.run_due_recurring_expenses ()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'NOT_AUTHENTICATED';
    END IF;
  END IF;
  RETURN jsonb_build_object('created_count', 0, 'message', 'Recurring expense materialisation (bond splits, anchors) remains on Express POST /api/recurring-expenses/run-due. No Postgres implementation yet.');
END;
$$;

COMMENT ON FUNCTION public.run_due_recurring_expenses () IS 'Safe no-op stub; bond-aware logic lives in Express (property.recurringExpenseMaterialize).';

GRANT EXECUTE ON FUNCTION public.run_due_recurring_income () TO authenticated;

GRANT EXECUTE ON FUNCTION public.run_due_recurring_invoices () TO authenticated;

GRANT EXECUTE ON FUNCTION public.run_due_recurring_expenses () TO authenticated;

GRANT EXECUTE ON FUNCTION public.run_due_recurring_income () TO service_role;

GRANT EXECUTE ON FUNCTION public.run_due_recurring_invoices () TO service_role;

GRANT EXECUTE ON FUNCTION public.run_due_recurring_expenses () TO service_role;
