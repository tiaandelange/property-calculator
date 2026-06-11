-- Use lease-centric tenant validation (same as invoices) so vacated / unlinked tenants can still receive statements.

CREATE OR REPLACE FUNCTION public.create_tenant_statement_with_line_items (
  p_property_id uuid,
  p_tenant_id uuid,
  p_lease_id uuid,
  p_statement_data jsonb,
  p_line_items jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_stmt_id uuid;
  v_num text;
  v_type public.app_tenant_statement_type;
  v_stmt_date timestamptz;
  v_status public.app_invoice_status;
  v_notes text;
  v_opening double precision := 0;
  v_period_start date;
  v_period_end date;
  v_subtotal double precision := 0;
  v_total double precision := 0;
  v_elem jsonb;
  v_qty double precision;
  v_up double precision;
  v_line_total double precision;
  v_desc text;
  v_entry public.app_statement_entry_type;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_OWNED';
  END IF;
  IF NOT public.tenant_valid_for_property (p_tenant_id, p_property_id, v_uid) THEN
    RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
  END IF;
  IF p_lease_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = p_lease_id
      AND l.property_id = p_property_id
      AND l.user_id = v_uid) THEN
    RAISE EXCEPTION 'LEASE_NOT_VALID_FOR_PROPERTY';
  END IF;
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) != 'array' OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'LINE_ITEMS_REQUIRED';
  END IF;

  v_type := coalesce(
    (p_statement_data ->> 'statement_type')::public.app_tenant_statement_type,
    (p_statement_data ->> 'statementType')::public.app_tenant_statement_type,
    'FINANCIAL'::public.app_tenant_statement_type);
  v_stmt_date := coalesce(
    (p_statement_data ->> 'statement_date')::timestamptz,
    (p_statement_data ->> 'statementDate')::timestamptz,
    now());
  v_status := coalesce(
    (p_statement_data ->> 'status')::public.app_invoice_status,
    'DRAFT'::public.app_invoice_status);
  v_notes := coalesce(p_statement_data ->> 'notes', NULL);
  v_opening := coalesce(
    (p_statement_data ->> 'opening_balance')::double precision,
    (p_statement_data ->> 'openingBalance')::double precision,
    0);
  v_period_start := coalesce(
    (p_statement_data ->> 'period_start')::date,
    (p_statement_data ->> 'periodStart')::date,
    NULL);
  v_period_end := coalesce(
    (p_statement_data ->> 'period_end')::date,
    (p_statement_data ->> 'periodEnd')::date,
    NULL);

  IF NULLIF(trim(coalesce(p_statement_data ->> 'statement_number', p_statement_data ->> 'statementNumber', '')), '') IS NOT NULL THEN
    v_num := trim(coalesce(p_statement_data ->> 'statement_number', p_statement_data ->> 'statementNumber'));
    IF EXISTS (SELECT 1 FROM public.tenant_statement_documents s WHERE s.statement_number = v_num) THEN
      RAISE EXCEPTION 'STATEMENT_NUMBER_TAKEN';
    END IF;
  ELSE
    v_num := public.generate_tenant_statement_number (v_type);
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
    v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), '');
    IF v_desc = '' THEN
      RAISE EXCEPTION 'LINE_ITEM_DESCRIPTION_REQUIRED';
    END IF;
    v_qty := coalesce((v_elem ->> 'quantity')::double precision, 1.0);
    v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
    v_line_total := coalesce((v_elem ->> 'total')::double precision, round((v_qty * v_up)::numeric, 2));
    v_entry := coalesce(
      (v_elem ->> 'entry_type')::public.app_statement_entry_type,
      (v_elem ->> 'entryType')::public.app_statement_entry_type,
      'DEBIT'::public.app_statement_entry_type);
    IF v_entry = 'CREDIT'::public.app_statement_entry_type THEN
      v_total := v_total - v_line_total;
    ELSE
      v_total := v_total + v_line_total;
    END IF;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  INSERT INTO public.tenant_statement_documents (
    user_id, property_id, tenant_id, lease_id, statement_type, statement_number,
    statement_date, period_start, period_end, opening_balance, subtotal, total, status, notes)
  VALUES (
    v_uid, p_property_id, p_tenant_id, p_lease_id, v_type, v_num,
    v_stmt_date, v_period_start, v_period_end, v_opening, v_subtotal, v_total, v_status, v_notes)
  RETURNING id INTO v_stmt_id;

  FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
    v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), '');
    v_qty := coalesce((v_elem ->> 'quantity')::double precision, 1.0);
    v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
    v_line_total := coalesce((v_elem ->> 'total')::double precision, round((v_qty * v_up)::numeric, 2));
    v_entry := coalesce(
      (v_elem ->> 'entry_type')::public.app_statement_entry_type,
      (v_elem ->> 'entryType')::public.app_statement_entry_type,
      'DEBIT'::public.app_statement_entry_type);
    INSERT INTO public.tenant_statement_line_items (
      statement_id, description, quantity, unit_price, total, entry_type, category, transaction_date, sort_order)
    VALUES (
      v_stmt_id,
      v_desc,
      v_qty,
      v_up,
      v_line_total,
      v_entry,
      coalesce(v_elem ->> 'category', NULL),
      coalesce((v_elem ->> 'transaction_date')::date, (v_elem ->> 'transactionDate')::date, NULL),
      coalesce((v_elem ->> 'sort_order')::integer, (v_elem ->> 'sortOrder')::integer, 0));
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_stmt_id,
    'statement_number', v_num,
    'statement_type', v_type,
    'status', v_status,
    'total', v_total);
END;
$$;

COMMENT ON FUNCTION public.create_tenant_statement_with_line_items IS
  'Creates a tenant statement; tenant may be linked via lease history, not only tenants.property_id.';
