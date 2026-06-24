-- Keep balance_due aligned with invoice total (incl. added line items) minus payments.

CREATE OR REPLACE FUNCTION public.update_invoice_with_line_items (
  p_invoice_id uuid,
  p_invoice_data jsonb,
  p_line_items jsonb DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invoices %ROWTYPE;
  v_elem jsonb;
  v_desc text;
  v_qty double precision;
  v_up double precision;
  v_line_total double precision;
  v_subtotal double precision := 0;
  v_category public.app_property_income_category;
  v_sort int := 0;
  v_lines jsonb;
  v_lifecycle_only boolean := false;
  v_client_total double precision;
  v_client_tax double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  SELECT * INTO v_inv FROM public.invoices
  WHERE id = p_invoice_id AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;
  IF NOT public.invoice_status_allows_content_edit(v_inv.status) THEN
    IF p_line_items IS NOT NULL AND jsonb_typeof(p_line_items) = 'array' THEN
      RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
    END IF;
    v_lifecycle_only := NOT (
      p_invoice_data ? 'invoice_date' OR p_invoice_data ? 'invoiceDate'
      OR p_invoice_data ? 'issue_date' OR p_invoice_data ? 'issueDate'
      OR p_invoice_data ? 'due_date' OR p_invoice_data ? 'dueDate'
      OR p_invoice_data ? 'notes' OR p_invoice_data ? 'Notes'
      OR p_invoice_data ? 'total' OR p_invoice_data ? 'Total'
      OR p_invoice_data ? 'subtotal' OR p_invoice_data ? 'Subtotal'
      OR p_invoice_data ? 'tax_amount' OR p_invoice_data ? 'taxAmount'
      OR p_invoice_data ? 'tenant_id' OR p_invoice_data ? 'tenantId'
      OR p_invoice_data ? 'lease_id' OR p_invoice_data ? 'leaseId'
      OR p_invoice_data ? 'unit_id' OR p_invoice_data ? 'unitId'
      OR p_invoice_data ? 'invoice_type' OR p_invoice_data ? 'invoiceType'
      OR p_invoice_data ? 'invoice_period' OR p_invoice_data ? 'invoicePeriod'
      OR p_invoice_data ? 'invoice_number' OR p_invoice_data ? 'invoiceNumber'
    );
    IF NOT v_lifecycle_only THEN
      RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
    END IF;
  ELSIF NOT public.invoice_status_is_editable(v_inv.status) THEN
    IF p_invoice_data ? 'status' OR p_invoice_data ? 'Status' THEN
      RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
    END IF;
  END IF;
  IF p_invoice_data ? 'invoice_date' OR p_invoice_data ? 'invoiceDate' THEN
    v_inv.invoice_date := coalesce((p_invoice_data ->> 'invoice_date')::timestamptz, (p_invoice_data ->> 'invoiceDate')::timestamptz, v_inv.invoice_date);
    v_inv.issue_date := v_inv.invoice_date;
  END IF;
  IF p_invoice_data ? 'issue_date' OR p_invoice_data ? 'issueDate' THEN
    v_inv.issue_date := coalesce((p_invoice_data ->> 'issue_date')::timestamptz, (p_invoice_data ->> 'issueDate')::timestamptz, v_inv.issue_date);
    v_inv.invoice_date := v_inv.issue_date;
  END IF;
  IF p_invoice_data ? 'due_date' OR p_invoice_data ? 'dueDate' THEN
    v_inv.due_date := coalesce((p_invoice_data ->> 'due_date')::timestamptz, (p_invoice_data ->> 'dueDate')::timestamptz, v_inv.due_date);
  END IF;
  IF p_invoice_data ? 'status' OR p_invoice_data ? 'Status' THEN
    v_inv.status := coalesce((p_invoice_data ->> 'status')::public.app_invoice_status, (p_invoice_data ->> 'Status')::public.app_invoice_status, v_inv.status);
  END IF;
  IF p_invoice_data ? 'notes' OR p_invoice_data ? 'Notes' THEN
    v_inv.notes := coalesce(p_invoice_data ->> 'notes', p_invoice_data ->> 'Notes', v_inv.notes);
  END IF;
  IF p_invoice_data ? 'tax_amount' OR p_invoice_data ? 'taxAmount' THEN
    v_inv.tax_amount := coalesce((p_invoice_data ->> 'tax_amount')::double precision, (p_invoice_data ->> 'taxAmount')::double precision, v_inv.tax_amount);
  END IF;
  IF p_invoice_data ? 'tenant_id' OR p_invoice_data ? 'tenantId' THEN
    v_inv.tenant_id := coalesce((p_invoice_data ->> 'tenant_id')::uuid, (p_invoice_data ->> 'tenantId')::uuid, v_inv.tenant_id);
    IF NOT public.tenant_valid_for_property(v_inv.tenant_id, v_inv.property_id, v_uid) THEN
      RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
    END IF;
  END IF;
  IF p_invoice_data ? 'lease_id' OR p_invoice_data ? 'leaseId' THEN
    IF (p_invoice_data ->> 'lease_id') IS NULL AND (p_invoice_data ->> 'leaseId') IS NULL THEN
      v_inv.lease_id := NULL;
      v_inv.unit_id := NULL;
    ELSE
      v_inv.lease_id := coalesce((p_invoice_data ->> 'lease_id')::uuid, (p_invoice_data ->> 'leaseId')::uuid);
      SELECT unit_id INTO v_inv.unit_id FROM public.leases l
      WHERE l.id = v_inv.lease_id AND l.property_id = v_inv.property_id AND l.user_id = v_uid;
    END IF;
    IF v_inv.lease_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = v_inv.lease_id AND l.property_id = v_inv.property_id AND l.user_id = v_uid) THEN
      RAISE EXCEPTION 'LEASE_NOT_VALID_FOR_PROPERTY';
    END IF;
  END IF;
  v_client_total := coalesce(
    (p_invoice_data ->> 'total')::double precision,
    (p_invoice_data ->> 'total_amount')::double precision,
    (p_invoice_data ->> 'totalAmount')::double precision,
    (p_invoice_data ->> 'Total')::double precision
  );
  v_client_tax := coalesce(
    (p_invoice_data ->> 'tax_amount')::double precision,
    (p_invoice_data ->> 'taxAmount')::double precision
  );
  IF p_line_items IS NOT NULL AND jsonb_typeof(p_line_items) = 'array' THEN
    DELETE FROM public.invoice_line_items WHERE invoice_id = p_invoice_id;
    v_sort := 0;
    FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
      v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
      IF v_desc = '' THEN
        RAISE EXCEPTION 'LINE_ITEM_DESCRIPTION_REQUIRED';
      END IF;
      v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
      v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
      v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'amount')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
      v_subtotal := v_subtotal + v_line_total;
      v_category := coalesce(
        (v_elem ->> 'category')::public.app_property_income_category,
        CASE
          WHEN v_inv.invoice_type = 'UTILITY_RECOVERY'::public.app_invoice_type THEN 'UTILITIES_RECOVERY'::public.app_property_income_category
          WHEN v_inv.invoice_type = 'RENT'::public.app_invoice_type THEN 'RENT'::public.app_property_income_category
          ELSE 'OTHER'::public.app_property_income_category
        END);
      v_sort := v_sort + 1;
      INSERT INTO public.invoice_line_items (invoice_id, description, category, quantity, unit_price, total, sort_order)
        VALUES (p_invoice_id, v_desc, v_category, v_qty, v_up, v_line_total, coalesce((v_elem ->> 'sort_order')::int, (v_elem ->> 'sortOrder')::int, v_sort));
    END LOOP;
    v_inv.subtotal := v_subtotal;
    IF v_client_tax IS NOT NULL THEN
      v_inv.tax_amount := v_client_tax;
    END IF;
    v_inv.total := coalesce(v_client_total, v_subtotal + coalesce(v_inv.tax_amount, 0));
    v_inv.total_amount := v_inv.total;
  ELSIF p_invoice_data ? 'total' OR p_invoice_data ? 'Total' OR p_invoice_data ? 'total_amount' OR p_invoice_data ? 'totalAmount' THEN
    v_inv.total := coalesce(v_client_total, v_inv.total);
    v_inv.total_amount := v_inv.total;
    v_inv.subtotal := coalesce((p_invoice_data ->> 'subtotal')::double precision, (p_invoice_data ->> 'Subtotal')::double precision, v_inv.subtotal);
  END IF;

  v_inv.balance_due := public.invoice_balance_due_for_total(
    p_invoice_id,
    coalesce(v_inv.total_amount, v_inv.total, 0),
    v_inv.status
  );

  UPDATE public.invoices
  SET
    invoice_date = v_inv.invoice_date,
    issue_date = v_inv.issue_date,
    due_date = v_inv.due_date,
    status = v_inv.status,
    notes = v_inv.notes,
    tenant_id = v_inv.tenant_id,
    lease_id = v_inv.lease_id,
    unit_id = v_inv.unit_id,
    tax_amount = v_inv.tax_amount,
    subtotal = v_inv.subtotal,
    total = v_inv.total,
    total_amount = v_inv.total_amount,
    balance_due = v_inv.balance_due,
    updated_at = now()
  WHERE id = p_invoice_id;

  SELECT jsonb_agg(to_jsonb(ili.*) ORDER BY ili.sort_order, ili.created_at, ili.id)
  INTO v_lines
  FROM public.invoice_line_items ili
  WHERE ili.invoice_id = p_invoice_id;

  RETURN (
    SELECT jsonb_build_object('invoice', to_jsonb(i.*), 'line_items', coalesce(v_lines, '[]'::jsonb))
    FROM public.invoices i
    WHERE i.id = p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_recompute_totals_from_lines (p_invoice_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.invoices %ROWTYPE;
  v_subtotal double precision;
  v_total double precision;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(ili.total), 0)
  INTO v_subtotal
  FROM public.invoice_line_items ili
  WHERE ili.invoice_id = p_invoice_id;

  v_total := round((v_subtotal + coalesce(v_inv.tax_amount, 0))::numeric, 2)::double precision;

  UPDATE public.invoices i
  SET
    subtotal = v_subtotal,
    total = v_total,
    total_amount = v_total,
    balance_due = public.invoice_balance_due_for_total(p_invoice_id, v_total, i.status),
    updated_at = now()
  WHERE i.id = p_invoice_id;
END;
$$;

-- Backfill stale balance_due values (e.g. rent-only after extra line items were added).
UPDATE public.invoices i
SET
  balance_due = public.invoice_balance_due_for_total(
    i.id,
    coalesce(i.total_amount, i.total, 0),
    i.status
  ),
  updated_at = now()
WHERE i.status NOT IN (
  'PAID'::public.app_invoice_status,
  'CANCELLED'::public.app_invoice_status,
  'VOID'::public.app_invoice_status
)
AND i.balance_due IS DISTINCT FROM public.invoice_balance_due_for_total(
  i.id,
  coalesce(i.total_amount, i.total, 0),
  i.status
);
