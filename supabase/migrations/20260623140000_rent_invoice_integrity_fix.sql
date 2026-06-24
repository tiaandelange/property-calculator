-- Rent invoice integrity: balance_due sync, line-item totals, repair broken auto invoices.

CREATE OR REPLACE FUNCTION public.invoice_balance_due_for_total (
  p_invoice_id uuid,
  p_total double precision,
  p_status public.app_invoice_status
)
  RETURNS double precision
  LANGUAGE sql
  STABLE
  AS $$
  SELECT CASE
    WHEN p_status IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status) THEN
      0::double precision
    ELSE
      greatest(
        0::double precision,
        coalesce(p_total, 0)
          - coalesce((
            SELECT sum(ip.amount)
            FROM public.invoice_payments ip
            WHERE ip.invoice_id = p_invoice_id
          ), 0)
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_sync_standard_fields ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_paid double precision;
BEGIN
  IF NEW.issue_date IS NULL THEN
    NEW.issue_date := NEW.invoice_date;
  END IF;
  IF NEW.invoice_date IS NULL THEN
    NEW.invoice_date := NEW.issue_date;
  END IF;
  IF NEW.total_amount IS NULL THEN
    NEW.total_amount := NEW.total;
  END IF;
  IF NEW.total IS NULL OR NEW.total IS DISTINCT FROM NEW.total_amount THEN
    NEW.total := NEW.total_amount;
  END IF;
  IF NEW.invoice_period IS NULL AND NEW.due_date IS NOT NULL THEN
    NEW.invoice_period := to_char((NEW.due_date AT TIME ZONE 'UTC')::date, 'YYYY-MM');
  ELSIF NEW.invoice_period IS NULL AND NEW.invoice_date IS NOT NULL THEN
    NEW.invoice_period := public.invoice_period_from_timestamptz(NEW.invoice_date);
  END IF;

  IF NEW.status = 'PAID'::public.app_invoice_status THEN
    NEW.balance_due := 0;
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  ELSIF NEW.status IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status) THEN
    NEW.balance_due := 0;
    IF NEW.archived_at IS NULL THEN
      NEW.archived_at := now();
    END IF;
  ELSE
    IF TG_OP = 'INSERT'
      OR NEW.balance_due IS NULL
      OR (
        TG_OP = 'UPDATE'
        AND (
          NEW.total IS DISTINCT FROM OLD.total
          OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
          OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
        )
      ) THEN
      NEW.balance_due := public.invoice_balance_due_for_total(
        NEW.id,
        coalesce(NEW.total_amount, NEW.total, 0),
        NEW.status
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- update_invoice_with_line_items: persist balance_due when totals change.
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
    v_inv.total := coalesce((p_invoice_data ->> 'total')::double precision, (p_invoice_data ->> 'total_amount')::double precision, (p_invoice_data ->> 'Total')::double precision, v_subtotal);
    v_inv.total_amount := v_inv.total;
  ELSIF p_invoice_data ? 'total' OR p_invoice_data ? 'Total' OR p_invoice_data ? 'total_amount' OR p_invoice_data ? 'totalAmount' THEN
    v_inv.total := coalesce(
      (p_invoice_data ->> 'total')::double precision,
      (p_invoice_data ->> 'total_amount')::double precision,
      (p_invoice_data ->> 'totalAmount')::double precision,
      (p_invoice_data ->> 'Total')::double precision,
      v_inv.total);
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

-- Repair rent invoices missing line items or stale totals (draft/generated only).
CREATE OR REPLACE FUNCTION public.repair_rent_invoices (p_property_id uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_inv public.invoices %ROWTYPE;
  v_line_count integer;
  v_line_total double precision;
  v_desc text;
  v_repaired integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' AND v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  FOR v_inv IN
    SELECT i.*
    FROM public.invoices i
    WHERE i.invoice_type = 'RENT'::public.app_invoice_type
      AND i.status IN ('DRAFT'::public.app_invoice_status, 'GENERATED'::public.app_invoice_status)
      AND (p_property_id IS NULL OR i.property_id = p_property_id)
      AND (v_role = 'service_role' OR i.user_id = v_uid)
  LOOP
    SELECT count(*), coalesce(sum(ili.total), 0)
    INTO v_line_count, v_line_total
    FROM public.invoice_line_items ili
    WHERE ili.invoice_id = v_inv.id;

    IF v_line_count = 0 AND v_inv.lease_id IS NOT NULL THEN
      SELECT public.rent_invoice_line_description(
        coalesce(v_inv.invoice_period, to_char((v_inv.due_date AT TIME ZONE 'UTC')::date, 'YYYY-MM')),
        tn.first_name,
        tn.last_name,
        pu.unit_name
      )
      INTO v_desc
      FROM public.leases l
      LEFT JOIN public.tenants tn ON tn.id = coalesce(v_inv.tenant_id, l.tenant_id)
      LEFT JOIN public.property_units pu ON pu.id = coalesce(v_inv.unit_id, l.unit_id)
      WHERE l.id = v_inv.lease_id;

      SELECT coalesce(v_inv.total_amount, v_inv.total, l.monthly_rent, 0)
      INTO v_line_total
      FROM public.leases l
      WHERE l.id = v_inv.lease_id;

      INSERT INTO public.invoice_line_items (
        invoice_id, description, category, quantity, unit_price, total, sort_order
      )
      VALUES (
        v_inv.id,
        coalesce(v_desc, 'Monthly Rent'),
        'RENT'::public.app_property_income_category,
        1,
        v_line_total,
        v_line_total,
        1
      );
    END IF;

    SELECT count(*), coalesce(sum(ili.total), 0)
    INTO v_line_count, v_line_total
    FROM public.invoice_line_items ili
    WHERE ili.invoice_id = v_inv.id;

    IF v_line_count > 0 AND (
      v_inv.subtotal IS DISTINCT FROM v_line_total
      OR v_inv.total IS DISTINCT FROM v_line_total
      OR v_inv.total_amount IS DISTINCT FROM v_line_total
    ) THEN
      UPDATE public.invoices
      SET
        subtotal = v_line_total,
        total = v_line_total,
        total_amount = v_line_total,
        balance_due = public.invoice_balance_due_for_total(v_inv.id, v_line_total, v_inv.status),
        updated_at = now()
      WHERE id = v_inv.id;
      v_repaired := v_repaired + 1;
    ELSIF v_line_count = 0 THEN
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'repaired', v_repaired,
    'skipped_no_lease', v_skipped,
    'property_id', CASE WHEN p_property_id IS NULL THEN NULL ELSE p_property_id::text END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_rent_invoices (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_rent_invoices (uuid) TO service_role;

COMMENT ON FUNCTION public.repair_rent_invoices (uuid) IS
  'Backfills missing rent invoice line items and syncs totals for DRAFT/GENERATED invoices.';
