-- Invoice tenant validation: lease-centric occupancy (tenants.property_id is no longer set on lease create).
-- Fixes TENANT_NOT_VALID_FOR_PROPERTY when saving drafts created via create_invoice_from_lease.

CREATE OR REPLACE FUNCTION public.tenant_valid_for_property (
  p_tenant_id uuid,
  p_property_id uuid,
  p_user_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND t.user_id = p_user_id
      AND (
        t.property_id = p_property_id
        OR t.applied_property_id = p_property_id
        OR EXISTS (
          SELECT 1
          FROM public.leases l
          WHERE l.tenant_id = t.id
            AND l.property_id = p_property_id
            AND l.user_id = p_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.lease_tenants lt
          INNER JOIN public.leases l ON l.id = lt.lease_id
          WHERE lt.tenant_id = t.id
            AND lt.user_id = p_user_id
            AND l.property_id = p_property_id
            AND l.user_id = p_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_unit_links tul
          WHERE tul.tenant_id = t.id
            AND tul.property_id = p_property_id
            AND tul.user_id = p_user_id
        )
      )
  );
$$;

COMMENT ON FUNCTION public.tenant_valid_for_property (uuid, uuid, uuid) IS
  'True when tenant is owned by user and linked to property via property_id, lease, lease_tenants, unit link, or application.';

REVOKE ALL ON FUNCTION public.tenant_valid_for_property (uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_valid_for_property (uuid, uuid, uuid) TO authenticated;

-- Patch create_invoice_with_line_items tenant check only (body unchanged otherwise).
CREATE OR REPLACE FUNCTION public.create_invoice_with_line_items (
  p_property_id uuid,
  p_tenant_id uuid,
  p_lease_id uuid,
  p_invoice_data jsonb,
  p_line_items jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv_id uuid;
  v_num text;
  v_invoice_date timestamptz;
  v_issue_date timestamptz;
  v_due_date timestamptz;
  v_status public.app_invoice_status;
  v_invoice_type public.app_invoice_type;
  v_invoice_period text;
  v_notes text;
  v_tax_amount double precision := 0;
  v_subtotal double precision := 0;
  v_total double precision := 0;
  v_unit_id uuid;
  v_lease public.leases %ROWTYPE;
  v_elem jsonb;
  v_qty double precision;
  v_up double precision;
  v_line_total double precision;
  v_desc text;
  v_category public.app_property_income_category;
  v_sort int := 0;
  v_display_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_OWNED';
  END IF;
  IF NOT public.tenant_valid_for_property(p_tenant_id, p_property_id, v_uid) THEN
    RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
  END IF;
  IF p_lease_id IS NOT NULL THEN
    SELECT * INTO v_lease FROM public.leases l
    WHERE l.id = p_lease_id AND l.property_id = p_property_id AND l.user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LEASE_NOT_VALID_FOR_PROPERTY';
    END IF;
    v_unit_id := v_lease.unit_id;
  END IF;
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) != 'array' OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'LINE_ITEMS_REQUIRED';
  END IF;
  v_invoice_date := coalesce(
    (p_invoice_data ->> 'invoice_date')::timestamptz,
    (p_invoice_data ->> 'invoiceDate')::timestamptz,
    (p_invoice_data ->> 'issue_date')::timestamptz,
    (p_invoice_data ->> 'issueDate')::timestamptz,
    now());
  v_issue_date := coalesce(
    (p_invoice_data ->> 'issue_date')::timestamptz,
    (p_invoice_data ->> 'issueDate')::timestamptz,
    v_invoice_date);
  v_due_date := coalesce(
    (p_invoice_data ->> 'due_date')::timestamptz,
    (p_invoice_data ->> 'dueDate')::timestamptz,
    v_invoice_date);
  v_status := coalesce(
    (p_invoice_data ->> 'status')::public.app_invoice_status,
    'DRAFT'::public.app_invoice_status);
  v_invoice_type := coalesce(
    (p_invoice_data ->> 'invoice_type')::public.app_invoice_type,
    (p_invoice_data ->> 'invoiceType')::public.app_invoice_type,
    'MANUAL'::public.app_invoice_type);
  v_invoice_period := coalesce(
    nullif(trim(p_invoice_data ->> 'invoice_period'), ''),
    nullif(trim(p_invoice_data ->> 'invoicePeriod'), ''),
    public.invoice_period_from_timestamptz(v_invoice_date));
  v_notes := coalesce(p_invoice_data ->> 'notes', p_invoice_data ->> 'Notes', NULL);
  v_tax_amount := coalesce(
    (p_invoice_data ->> 'tax_amount')::double precision,
    (p_invoice_data ->> 'taxAmount')::double precision,
    0);
  IF p_invoice_data ? 'unit_id' OR p_invoice_data ? 'unitId' THEN
    v_unit_id := coalesce((p_invoice_data ->> 'unit_id')::uuid, (p_invoice_data ->> 'unitId')::uuid);
  END IF;
  IF v_invoice_type = 'RENT'::public.app_invoice_type THEN
    IF p_lease_id IS NULL THEN
      RAISE EXCEPTION 'RENT_INVOICE_REQUIRES_LEASE';
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
  END IF;
  IF NULLIF(trim(coalesce(p_invoice_data ->> 'invoice_number', p_invoice_data ->> 'invoiceNumber', '')), '') IS NOT NULL THEN
    v_num := trim(coalesce(p_invoice_data ->> 'invoice_number', p_invoice_data ->> 'invoiceNumber'));
    IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.invoice_number = v_num) THEN
      RAISE EXCEPTION 'INVOICE_NUMBER_TAKEN';
    END IF;
  ELSE
    v_num := public.generate_invoice_number();
  END IF;
  FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
    v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
    IF v_desc = '' THEN
      RAISE EXCEPTION 'LINE_ITEM_DESCRIPTION_REQUIRED';
    END IF;
    v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
    v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
    v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'amount')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_total := coalesce(
    (p_invoice_data ->> 'total')::double precision,
    (p_invoice_data ->> 'total_amount')::double precision,
    (p_invoice_data ->> 'totalAmount')::double precision,
    (p_invoice_data ->> 'Total')::double precision,
    v_subtotal);
  IF (p_invoice_data ? 'subtotal') OR (p_invoice_data ? 'Subtotal') THEN
    v_subtotal := coalesce((p_invoice_data ->> 'subtotal')::double precision, (p_invoice_data ->> 'Subtotal')::double precision, v_subtotal);
  END IF;
  INSERT INTO public.invoices (
    user_id, property_id, tenant_id, lease_id, unit_id,
    invoice_number, invoice_type, invoice_period,
    invoice_date, issue_date, due_date, status,
    subtotal, tax_amount, total, total_amount, balance_due, notes, pdf_path
  )
  VALUES (
    v_uid, p_property_id, p_tenant_id, p_lease_id, v_unit_id,
    v_num, v_invoice_type, v_invoice_period,
    v_invoice_date, v_issue_date, v_due_date, v_status,
    v_subtotal, v_tax_amount, v_total, v_total, v_total, v_notes, NULL
  )
  RETURNING id INTO v_inv_id;
  v_sort := 0;
  FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
    v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
    v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
    v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
    v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'amount')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
    v_category := coalesce(
      (v_elem ->> 'category')::public.app_property_income_category,
      CASE
        WHEN v_invoice_type = 'UTILITY_RECOVERY'::public.app_invoice_type THEN 'UTILITIES_RECOVERY'::public.app_property_income_category
        WHEN v_invoice_type = 'RENT'::public.app_invoice_type THEN 'RENT'::public.app_property_income_category
        ELSE 'OTHER'::public.app_property_income_category
      END);
    v_sort := v_sort + 1;
    INSERT INTO public.invoice_line_items (invoice_id, description, category, quantity, unit_price, total, sort_order)
      VALUES (v_inv_id, v_desc, v_category, v_qty, v_up, v_line_total, coalesce((v_elem ->> 'sort_order')::int, (v_elem ->> 'sortOrder')::int, v_sort));
  END LOOP;
  RETURN (
    SELECT jsonb_build_object(
      'invoice', to_jsonb(i.*),
      'line_items', coalesce((
        SELECT jsonb_agg(to_jsonb(ili.*) ORDER BY ili.sort_order, ili.created_at, ili.id)
        FROM public.invoice_line_items ili
        WHERE ili.invoice_id = v_inv_id), '[]'::jsonb))
    FROM public.invoices i
    WHERE i.id = v_inv_id);
END;
$$;

-- Patch update_invoice_with_line_items tenant check (delegate to helper).
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
  IF NOT public.invoice_status_is_editable(v_inv.status) THEN
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
