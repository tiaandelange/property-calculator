-- Invoice CRUD helpers: atomic create/update with line items, race-safe numbering, hard delete (any status).

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE OR REPLACE FUNCTION public.generate_invoice_number ()
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  RETURN 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 12, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_number () IS 'Monotonic human-readable invoice numbers; use inside invoice RPCs to avoid client-side races.';

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
  v_uid uuid := auth.uid ();
  v_inv_id uuid;
  v_num text;
  v_invoice_date timestamptz;
  v_due_date timestamptz;
  v_status public.app_invoice_status;
  v_notes text;
  v_subtotal double precision := 0;
  v_total double precision := 0;
  v_elem jsonb;
  v_qty double precision;
  v_up double precision;
  v_line_total double precision;
  v_desc text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.properties p
    WHERE
      p.id = p_property_id
      AND p.user_id = v_uid) THEN
    RAISE EXCEPTION 'PROPERTY_NOT_OWNED';
  END IF;
  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.tenants t
    WHERE
      t.id = p_tenant_id
      AND t.property_id = p_property_id
      AND t.user_id = v_uid) THEN
    RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
  END IF;
  IF p_lease_id IS NOT NULL AND NOT EXISTS (
    SELECT
      1
    FROM
      public.leases l
    WHERE
      l.id = p_lease_id
      AND l.property_id = p_property_id
      AND l.user_id = v_uid) THEN
    RAISE EXCEPTION 'LEASE_NOT_VALID_FOR_PROPERTY';
  END IF;
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) != 'array' OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'LINE_ITEMS_REQUIRED';
  END IF;
  v_invoice_date := coalesce(
    (p_invoice_data ->> 'invoice_date')::timestamptz,
    (p_invoice_data ->> 'invoiceDate')::timestamptz,
    now());
  v_due_date := coalesce(
    (p_invoice_data ->> 'due_date')::timestamptz,
    (p_invoice_data ->> 'dueDate')::timestamptz,
    v_invoice_date);
  v_status := coalesce(
    (p_invoice_data ->> 'status')::public.app_invoice_status,
    'DRAFT'::public.app_invoice_status);
  v_notes := coalesce(p_invoice_data ->> 'notes', p_invoice_data ->> 'Notes', NULL);
  IF NULLIF(trim(coalesce(p_invoice_data ->> 'invoice_number', p_invoice_data ->> 'invoiceNumber', '')), '') IS NOT NULL THEN
    v_num := trim(coalesce(p_invoice_data ->> 'invoice_number', p_invoice_data ->> 'invoiceNumber'));
    IF EXISTS (
      SELECT
        1
      FROM
        public.invoices i
      WHERE
        i.invoice_number = v_num) THEN
      RAISE EXCEPTION 'INVOICE_NUMBER_TAKEN';
    END IF;
  ELSE
    v_num := public.generate_invoice_number ();
  END IF;
  FOR v_elem IN
  SELECT
    jsonb_array_elements(p_line_items)
    LOOP
      v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
      IF v_desc = '' THEN
        RAISE EXCEPTION 'LINE_ITEM_DESCRIPTION_REQUIRED';
      END IF;
      v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
      v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
      v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
      v_subtotal := v_subtotal + v_line_total;
    END LOOP;
  v_total := coalesce((p_invoice_data ->> 'total')::double precision, (p_invoice_data ->> 'Total')::double precision, v_subtotal);
  IF (p_invoice_data ? 'subtotal') OR (p_invoice_data ? 'Subtotal') THEN
    v_subtotal := coalesce((p_invoice_data ->> 'subtotal')::double precision, (p_invoice_data ->> 'Subtotal')::double precision, v_subtotal);
  END IF;
  INSERT INTO public.invoices (user_id, property_id, tenant_id, lease_id, invoice_number, invoice_date, due_date, status, subtotal, total, notes, pdf_path)
    VALUES (v_uid, p_property_id, p_tenant_id, p_lease_id, v_num, v_invoice_date, v_due_date, v_status, v_subtotal, v_total, v_notes, NULL)
  RETURNING
    id INTO v_inv_id;
  FOR v_elem IN
  SELECT
    jsonb_array_elements(p_line_items)
    LOOP
      v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
      v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
      v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
      v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
      INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, total)
        VALUES (v_inv_id, v_desc, v_qty, v_up, v_line_total);
    END LOOP;
  RETURN (
    SELECT
      jsonb_build_object('invoice', to_jsonb (i.*), 'line_items', coalesce((
          SELECT
            jsonb_agg(to_jsonb (ili.*) ORDER BY ili.created_at, ili.id)
          FROM public.invoice_line_items ili
        WHERE
          ili.invoice_id = v_inv_id), '[]'::jsonb))
    FROM
      public.invoices i
    WHERE
      i.id = v_inv_id);
END;
$$;

COMMENT ON FUNCTION public.create_invoice_with_line_items (uuid, uuid, uuid, jsonb, jsonb) IS 'Creates invoice + line items in one transaction; pdf_path left null until PDF pipeline is migrated.';

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
  v_uid uuid := auth.uid ();
  v_inv public.invoices %ROWTYPE;
  v_elem jsonb;
  v_desc text;
  v_qty double precision;
  v_up double precision;
  v_line_total double precision;
  v_subtotal double precision := 0;
  v_total double precision;
  v_lines jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  SELECT
    * INTO v_inv
  FROM
    public.invoices
  WHERE
    id = p_invoice_id
    AND user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;
  IF p_invoice_data ? 'invoice_date' OR p_invoice_data ? 'invoiceDate' THEN
    v_inv.invoice_date := coalesce((p_invoice_data ->> 'invoice_date')::timestamptz, (p_invoice_data ->> 'invoiceDate')::timestamptz, v_inv.invoice_date);
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
  IF p_invoice_data ? 'tenant_id' OR p_invoice_data ? 'tenantId' THEN
    v_inv.tenant_id := coalesce((p_invoice_data ->> 'tenant_id')::uuid, (p_invoice_data ->> 'tenantId')::uuid, v_inv.tenant_id);
    IF NOT EXISTS (
      SELECT
        1
      FROM
        public.tenants t
      WHERE
        t.id = v_inv.tenant_id
        AND t.property_id = v_inv.property_id
        AND t.user_id = v_uid) THEN
      RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
    END IF;
  END IF;
  IF p_invoice_data ? 'lease_id' OR p_invoice_data ? 'leaseId' THEN
    IF (p_invoice_data ->> 'lease_id') IS NULL AND (p_invoice_data ->> 'leaseId') IS NULL THEN
      v_inv.lease_id := NULL;
    ELSE
      v_inv.lease_id := coalesce((p_invoice_data ->> 'lease_id')::uuid, (p_invoice_data ->> 'leaseId')::uuid);
    END IF;
    IF v_inv.lease_id IS NOT NULL AND NOT EXISTS (
      SELECT
        1
      FROM
        public.leases l
      WHERE
        l.id = v_inv.lease_id
        AND l.property_id = v_inv.property_id
        AND l.user_id = v_uid) THEN
      RAISE EXCEPTION 'LEASE_NOT_VALID_FOR_PROPERTY';
    END IF;
  END IF;
  IF p_line_items IS NOT NULL AND jsonb_typeof(p_line_items) = 'array' THEN
    DELETE FROM public.invoice_line_items
    WHERE invoice_id = p_invoice_id;
    FOR v_elem IN
    SELECT
      jsonb_array_elements(p_line_items)
      LOOP
        v_desc := coalesce(nullif(trim(v_elem ->> 'description'), ''), nullif(trim(v_elem ->> 'Description'), ''), '');
        IF v_desc = '' THEN
          RAISE EXCEPTION 'LINE_ITEM_DESCRIPTION_REQUIRED';
        END IF;
        v_qty := coalesce((v_elem ->> 'quantity')::double precision, (v_elem ->> 'Quantity')::double precision, 1.0);
        v_up := coalesce((v_elem ->> 'unit_price')::double precision, (v_elem ->> 'unitPrice')::double precision, 0.0);
        v_line_total := coalesce((v_elem ->> 'total')::double precision, (v_elem ->> 'Total')::double precision, v_qty * v_up);
        v_subtotal := v_subtotal + v_line_total;
        INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, total)
          VALUES (p_invoice_id, v_desc, v_qty, v_up, v_line_total);
      END LOOP;
    v_inv.subtotal := v_subtotal;
    v_inv.total := coalesce((p_invoice_data ->> 'total')::double precision, (p_invoice_data ->> 'Total')::double precision, v_subtotal);
  ELSIF p_invoice_data ? 'total' OR p_invoice_data ? 'Total' THEN
    v_inv.total := coalesce((p_invoice_data ->> 'total')::double precision, (p_invoice_data ->> 'Total')::double precision, v_inv.total);
    v_inv.subtotal := coalesce((p_invoice_data ->> 'subtotal')::double precision, (p_invoice_data ->> 'Subtotal')::double precision, v_inv.subtotal);
  END IF;
  UPDATE
    public.invoices
  SET
    invoice_date = v_inv.invoice_date,
    due_date = v_inv.due_date,
    status = v_inv.status,
    notes = v_inv.notes,
    tenant_id = v_inv.tenant_id,
    lease_id = v_inv.lease_id,
    subtotal = v_inv.subtotal,
    total = v_inv.total,
    updated_at = now()
  WHERE
    id = p_invoice_id;
  SELECT
    jsonb_agg(to_jsonb (ili.*) ORDER BY ili.created_at, ili.id)
  INTO v_lines
  FROM
    public.invoice_line_items ili
  WHERE
    ili.invoice_id = p_invoice_id;
  RETURN (
    SELECT
      jsonb_build_object('invoice', to_jsonb (i.*), 'line_items', coalesce(v_lines, '[]'::jsonb))
    FROM
      public.invoices i
    WHERE
      i.id = p_invoice_id);
END;
$$;

COMMENT ON FUNCTION public.update_invoice_with_line_items (uuid, jsonb, jsonb) IS 'Updates invoice header; when p_line_items is a JSON array, replaces all line items and recomputes subtotal. Pass NULL p_line_items to leave line items unchanged.';

CREATE OR REPLACE FUNCTION public.hard_delete_invoice (p_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  DELETE FROM public.invoices
  WHERE id = p_id
    AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;
  RETURN jsonb_build_object('message', 'Deleted');
END;
$$;

COMMENT ON FUNCTION public.hard_delete_invoice (uuid) IS 'Hard-deletes invoice (cascade line items); bypasses RLS DRAFT-only DELETE for Express parity.';

GRANT EXECUTE ON FUNCTION public.generate_invoice_number () TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_invoice_with_line_items (uuid, uuid, uuid, jsonb, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_invoice_with_line_items (uuid, jsonb, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.hard_delete_invoice (uuid) TO authenticated;
