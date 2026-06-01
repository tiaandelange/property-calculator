-- Allow invoice content edits after send (until paid/cancelled/void). Draft-only remains for mark-as-sent eligibility.

CREATE OR REPLACE FUNCTION public.invoice_status_allows_content_edit (p_status public.app_invoice_status)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT p_status NOT IN (
    'PAID'::public.app_invoice_status,
    'CANCELLED'::public.app_invoice_status,
    'VOID'::public.app_invoice_status
  );
$$;

COMMENT ON FUNCTION public.invoice_status_allows_content_edit (public.app_invoice_status) IS
  'True when invoice header and line items may be edited (includes SENT and PARTIALLY_PAID).';

CREATE OR REPLACE FUNCTION public.invoices_enforce_editability ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT public.invoice_status_allows_content_edit(OLD.status) THEN
    IF NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
      OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
      OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
      OR NEW.invoice_type IS DISTINCT FROM OLD.invoice_type
      OR NEW.invoice_period IS DISTINCT FROM OLD.invoice_period
      OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoice_line_items_guard_editable ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_status public.app_invoice_status;
  v_invoice_id uuid;
BEGIN
  v_invoice_id := coalesce(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO v_status FROM public.invoices WHERE id = v_invoice_id;
  IF v_status IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF NOT public.invoice_status_allows_content_edit(v_status) THEN
    RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

-- Allow update_invoice_with_line_items for sent / partially paid invoices (not only draft).
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
