-- Manual lease-linked invoice generation (duplicate-safe; lease_id required).

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

COMMENT ON FUNCTION public.manual_generate_lease_invoice (
  uuid, text, public.app_invoice_type, date, double precision, text
) IS
  'Manual lease invoice generation. Requires lease_id; dedupes on lease_id + invoice_period + invoice_type.';

REVOKE ALL ON FUNCTION public.manual_generate_lease_invoice (
  uuid, text, public.app_invoice_type, date, double precision, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_generate_lease_invoice (
  uuid, text, public.app_invoice_type, date, double precision, text
) TO authenticated;
