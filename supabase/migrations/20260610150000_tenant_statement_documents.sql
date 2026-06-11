-- Tenant statement documents (financial + deposit) — mirrors invoice draft/send/PDF flow.

CREATE TYPE public.app_tenant_statement_type AS ENUM (
  'FINANCIAL',
  'DEPOSIT'
);

CREATE TYPE public.app_statement_entry_type AS ENUM (
  'DEBIT',
  'CREDIT'
);

CREATE SEQUENCE IF NOT EXISTS public.tenant_statement_number_seq;

CREATE OR REPLACE FUNCTION public.generate_tenant_statement_number (p_type public.app_tenant_statement_type)
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  IF p_type = 'DEPOSIT'::public.app_tenant_statement_type THEN
    RETURN 'STM-DEP-' || lpad(nextval('public.tenant_statement_number_seq')::text, 8, '0');
  END IF;
  RETURN 'STM-FIN-' || lpad(nextval('public.tenant_statement_number_seq')::text, 8, '0');
END;
$$;

CREATE TABLE public.tenant_statement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases (id) ON DELETE SET NULL,
  statement_type public.app_tenant_statement_type NOT NULL,
  statement_number text NOT NULL,
  statement_date timestamptz NOT NULL DEFAULT now(),
  period_start date,
  period_end date,
  opening_balance double precision NOT NULL DEFAULT 0,
  subtotal double precision NOT NULL DEFAULT 0,
  total double precision NOT NULL DEFAULT 0,
  status public.app_invoice_status NOT NULL DEFAULT 'DRAFT',
  notes text,
  pdf_storage_bucket text,
  pdf_storage_key text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_statement_documents_statement_number_key UNIQUE (statement_number)
);

CREATE INDEX tenant_statement_documents_user_id_idx ON public.tenant_statement_documents (user_id);
CREATE INDEX tenant_statement_documents_property_id_idx ON public.tenant_statement_documents (property_id);
CREATE INDEX tenant_statement_documents_tenant_id_idx ON public.tenant_statement_documents (tenant_id);

CREATE TABLE public.tenant_statement_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  statement_id uuid NOT NULL REFERENCES public.tenant_statement_documents (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity double precision NOT NULL DEFAULT 1,
  unit_price double precision NOT NULL DEFAULT 0,
  total double precision NOT NULL DEFAULT 0,
  entry_type public.app_statement_entry_type NOT NULL DEFAULT 'DEBIT',
  category text,
  transaction_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_statement_line_items_statement_id_idx ON public.tenant_statement_line_items (statement_id);

ALTER TABLE public.tenant_statement_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_statement_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_statement_documents_select_own ON public.tenant_statement_documents
  FOR SELECT
  USING (user_id = auth.uid ());

CREATE POLICY tenant_statement_documents_insert_own ON public.tenant_statement_documents
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.user_id = auth.uid ())
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_id AND t.user_id = auth.uid () AND t.property_id = property_id));

CREATE POLICY tenant_statement_documents_update_own ON public.tenant_statement_documents
  FOR UPDATE
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY tenant_statement_documents_delete_draft_own ON public.tenant_statement_documents
  FOR DELETE
  USING (user_id = auth.uid () AND status = 'DRAFT'::public.app_invoice_status);

CREATE POLICY tenant_statement_line_items_select_own ON public.tenant_statement_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_statement_documents s
      WHERE s.id = statement_id AND s.user_id = auth.uid ()));

CREATE POLICY tenant_statement_line_items_insert_own ON public.tenant_statement_line_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_statement_documents s
      WHERE s.id = statement_id AND s.user_id = auth.uid ()));

CREATE POLICY tenant_statement_line_items_update_own ON public.tenant_statement_line_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_statement_documents s
      WHERE s.id = statement_id AND s.user_id = auth.uid ()));

CREATE POLICY tenant_statement_line_items_delete_own ON public.tenant_statement_line_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_statement_documents s
      WHERE s.id = statement_id AND s.user_id = auth.uid ()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_statement_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_statement_line_items TO authenticated;

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
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.property_id = p_property_id AND t.user_id = v_uid) THEN
    RAISE EXCEPTION 'TENANT_NOT_VALID_FOR_PROPERTY';
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

CREATE OR REPLACE FUNCTION public.update_tenant_statement_with_line_items (
  p_statement_id uuid,
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
    SELECT 1 FROM public.tenant_statement_documents s
    WHERE s.id = p_statement_id AND s.user_id = v_uid) THEN
    RAISE EXCEPTION 'STATEMENT_NOT_FOUND';
  END IF;

  IF p_line_items IS NOT NULL AND jsonb_typeof(p_line_items) = 'array' THEN
    FOR v_elem IN SELECT jsonb_array_elements(p_line_items) LOOP
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

    DELETE FROM public.tenant_statement_line_items WHERE statement_id = p_statement_id;

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
      INSERT INTO public.tenant_statement_line_items (
        statement_id, description, quantity, unit_price, total, entry_type, category, transaction_date, sort_order)
      VALUES (
        p_statement_id,
        v_desc,
        v_qty,
        v_up,
        v_line_total,
        v_entry,
        coalesce(v_elem ->> 'category', NULL),
        coalesce((v_elem ->> 'transaction_date')::date, (v_elem ->> 'transactionDate')::date, NULL),
        coalesce((v_elem ->> 'sort_order')::integer, (v_elem ->> 'sortOrder')::integer, 0));
    END LOOP;
  END IF;

  UPDATE public.tenant_statement_documents
  SET
    statement_date = coalesce(
      (p_statement_data ->> 'statement_date')::timestamptz,
      (p_statement_data ->> 'statementDate')::timestamptz,
      statement_date),
    period_start = coalesce(
      (p_statement_data ->> 'period_start')::date,
      (p_statement_data ->> 'periodStart')::date,
      period_start),
    period_end = coalesce(
      (p_statement_data ->> 'period_end')::date,
      (p_statement_data ->> 'periodEnd')::date,
      period_end),
    opening_balance = coalesce(
      (p_statement_data ->> 'opening_balance')::double precision,
      (p_statement_data ->> 'openingBalance')::double precision,
      opening_balance),
    notes = CASE WHEN p_statement_data ? 'notes' THEN p_statement_data ->> 'notes' ELSE notes END,
    status = coalesce(
      (p_statement_data ->> 'status')::public.app_invoice_status,
      status),
    subtotal = CASE WHEN p_line_items IS NOT NULL THEN v_subtotal ELSE subtotal END,
    total = CASE WHEN p_line_items IS NOT NULL THEN v_total ELSE total END,
    updated_at = now()
  WHERE id = p_statement_id AND user_id = v_uid;

  RETURN jsonb_build_object('id', p_statement_id, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.hard_delete_tenant_statement (p_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_status public.app_invoice_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  SELECT status INTO v_status
  FROM public.tenant_statement_documents
  WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATEMENT_NOT_FOUND';
  END IF;
  IF v_status != 'DRAFT'::public.app_invoice_status THEN
    RAISE EXCEPTION 'ONLY_DRAFT_STATEMENTS_CAN_BE_DELETED';
  END IF;
  DELETE FROM public.tenant_statement_documents WHERE id = p_id AND user_id = v_uid;
  RETURN jsonb_build_object('message', 'Statement deleted.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_statement_with_line_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_statement_with_line_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_tenant_statement TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tenant_statement_number TO authenticated;
