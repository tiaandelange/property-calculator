-- Standardise global invoice foundation on existing `invoices` + `invoice_line_items` tables.
-- Does NOT create duplicate invoice tables. Extends enums/columns, adds read-only `invoice_items` view,
-- editability guards, indexes, and rent-invoice deduplication.
-- Prerequisite: 20260530200000_invoice_foundation_enums.sql

-- ---------------------------------------------------------------------------
-- invoices — additive columns (preserve legacy invoice_date / total / tenant_id)
-- ---------------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.property_units (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_type public.app_invoice_type NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS invoice_period text,
  ADD COLUMN IF NOT EXISTS issue_date timestamptz,
  ADD COLUMN IF NOT EXISTS tax_amount double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount double precision,
  ADD COLUMN IF NOT EXISTS balance_due double precision;

COMMENT ON COLUMN public.invoices.user_id IS
  'Invoice owner (auth.uid / profiles.id). Canonical owner field for RLS.';
COMMENT ON COLUMN public.invoices.tenant_id IS
  'Primary billing tenant (primary_tenant_id in product vocabulary).';
COMMENT ON COLUMN public.invoices.invoice_date IS
  'Legacy issue date; kept for backward compatibility. Synced with issue_date.';
COMMENT ON COLUMN public.invoices.issue_date IS
  'Invoice issue date. Defaults to invoice_date when omitted.';
COMMENT ON COLUMN public.invoices.total IS
  'Legacy total; kept for backward compatibility. Synced with total_amount.';
COMMENT ON COLUMN public.invoices.total_amount IS
  'Invoice total including tax. Defaults to total when omitted.';
COMMENT ON COLUMN public.invoices.archived_at IS
  'Soft delete timestamp (deleted_at semantics). Prefer status CANCELLED/VOID + archived_at over hard delete.';

-- Backfill standard fields on existing rows
UPDATE public.invoices
SET
  issue_date = coalesce(issue_date, invoice_date),
  total_amount = coalesce(total_amount, total),
  balance_due = CASE
    WHEN coalesce(balance_due, total, 0) = 0 AND status = 'PAID'::public.app_invoice_status THEN 0
    ELSE coalesce(balance_due, total, 0)
  END,
  invoice_period = coalesce(
    invoice_period,
    to_char(invoice_date AT TIME ZONE 'UTC', 'YYYY-MM')
  )
WHERE issue_date IS NULL
  OR total_amount IS NULL
  OR balance_due IS NULL
  OR invoice_period IS NULL;

UPDATE public.invoices i
SET unit_id = l.unit_id
FROM public.leases l
WHERE i.lease_id = l.id
  AND i.unit_id IS NULL
  AND l.unit_id IS NOT NULL;

UPDATE public.invoices
SET invoice_type = 'RENT'::public.app_invoice_type
WHERE lease_id IS NOT NULL
  AND invoice_type = 'MANUAL'::public.app_invoice_type
  AND EXISTS (
    SELECT 1
    FROM public.invoice_line_items ili
    WHERE ili.invoice_id = invoices.id
      AND lower(trim(ili.description)) IN ('monthly rent', 'rent')
  );

-- ---------------------------------------------------------------------------
-- invoice_line_items — category, sort_order (amount aliases `total`)
-- ---------------------------------------------------------------------------

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS category public.app_property_income_category NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.invoice_line_items ili
SET category = 'RENT'::public.app_property_income_category
FROM public.invoices i
WHERE ili.invoice_id = i.id
  AND ili.category = 'OTHER'::public.app_property_income_category
  AND (
    i.invoice_type = 'RENT'::public.app_invoice_type
    OR lower(trim(ili.description)) IN ('monthly rent', 'rent')
  );

UPDATE public.invoice_line_items ili
SET category = 'UTILITIES_RECOVERY'::public.app_property_income_category
FROM public.invoices i
WHERE ili.invoice_id = i.id
  AND ili.category = 'OTHER'::public.app_property_income_category
  AND i.invoice_type = 'UTILITY_RECOVERY'::public.app_invoice_type;

-- Read-only view: preferred `invoice_items` name maps to canonical `invoice_line_items` table.
CREATE OR REPLACE VIEW public.invoice_items AS
SELECT
  id,
  invoice_id,
  description,
  category,
  quantity,
  unit_price,
  total AS amount,
  sort_order,
  created_at,
  updated_at
FROM public.invoice_line_items;

COMMENT ON VIEW public.invoice_items IS
  'Read-only alias of invoice_line_items. Single global line-item store; do not duplicate.';

GRANT SELECT ON public.invoice_items TO authenticated;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS invoices_lease_id_idx ON public.invoices (lease_id);
CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_invoice_period_idx ON public.invoices (invoice_period);
CREATE INDEX IF NOT EXISTS invoices_unit_id_idx ON public.invoices (unit_id);
CREATE INDEX IF NOT EXISTS invoices_property_status_due_idx ON public.invoices (property_id, status, due_date);
CREATE INDEX IF NOT EXISTS invoice_line_items_sort_idx ON public.invoice_line_items (invoice_id, sort_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_rent_lease_period_uniq
  ON public.invoices (lease_id, invoice_period, invoice_type)
  WHERE lease_id IS NOT NULL
    AND invoice_type = 'RENT'::public.app_invoice_type
    AND status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoice_period_from_timestamptz (p_ts timestamptz)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT to_char(p_ts AT TIME ZONE 'UTC', 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION public.invoice_status_is_editable (p_status public.app_invoice_status)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT p_status IN ('DRAFT'::public.app_invoice_status, 'GENERATED'::public.app_invoice_status);
$$;

CREATE OR REPLACE FUNCTION public.invoices_sync_standard_fields ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
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
  IF NEW.invoice_period IS NULL AND NEW.invoice_date IS NOT NULL THEN
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
  ELSIF NEW.balance_due IS NULL THEN
    NEW.balance_due := coalesce(NEW.total_amount, NEW.total, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_sync_standard_fields_trg ON public.invoices;
CREATE TRIGGER invoices_sync_standard_fields_trg
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invoices_sync_standard_fields();

CREATE OR REPLACE FUNCTION public.invoices_enforce_editability ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT public.invoice_status_is_editable(OLD.status) THEN
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

DROP TRIGGER IF EXISTS invoices_enforce_editability_trg ON public.invoices;
CREATE TRIGGER invoices_enforce_editability_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invoices_enforce_editability();

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
  IF NOT public.invoice_status_is_editable(v_status) THEN
    RAISE EXCEPTION 'INVOICE_NOT_EDITABLE';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS invoice_line_items_guard_editable_trg ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_guard_editable_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.invoice_line_items_guard_editable();

-- ---------------------------------------------------------------------------
-- RLS — strengthen unit_id ownership (do not weaken existing checks)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_own ON public.invoices;
DROP POLICY IF EXISTS invoices_update_own ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_draft_own ON public.invoices;

CREATE POLICY invoices_select_own ON public.invoices
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = invoices.property_id AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = invoices.tenant_id AND t.user_id = auth.uid()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = invoices.lease_id AND l.user_id = auth.uid()
    )
  )
  AND (
    unit_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.property_units u
      WHERE u.id = invoices.unit_id
        AND u.property_id = invoices.property_id
        AND u.user_id = auth.uid()
    )
  )
);

CREATE POLICY invoices_insert_own ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_id AND t.user_id = auth.uid()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND l.user_id = auth.uid()
    )
  )
  AND (
    unit_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.property_units u
      WHERE u.id = unit_id
        AND u.property_id = property_id
        AND u.user_id = auth.uid()
    )
  )
);

CREATE POLICY invoices_update_own ON public.invoices
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = invoices.property_id AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = invoices.tenant_id AND t.user_id = auth.uid()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = invoices.lease_id AND l.user_id = auth.uid()
    )
  )
  AND (
    unit_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.property_units u
      WHERE u.id = invoices.unit_id
        AND u.property_id = invoices.property_id
        AND u.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id AND p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_id AND t.user_id = auth.uid()
  )
  AND (
    lease_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.leases l
      WHERE l.id = lease_id AND l.user_id = auth.uid()
    )
  )
  AND (
    unit_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.property_units u
      WHERE u.id = unit_id
        AND u.property_id = property_id
        AND u.user_id = auth.uid()
    )
  )
);

CREATE POLICY invoices_delete_draft_own ON public.invoices
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND status IN ('DRAFT'::public.app_invoice_status, 'GENERATED'::public.app_invoice_status)
);

COMMENT ON POLICY invoices_delete_draft_own ON public.invoices IS
  'Hard delete via client allowed only for DRAFT/GENERATED. Sent invoices: cancel/void via status + archived_at or hard_delete_invoice RPC.';

-- ---------------------------------------------------------------------------
-- RPC: create_invoice_with_line_items (extended fields + RENT lease validation)
-- ---------------------------------------------------------------------------

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
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.property_id = p_property_id AND t.user_id = v_uid) THEN
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

-- ---------------------------------------------------------------------------
-- RPC: update_invoice_with_line_items (edit guard for non-draft/generated)
-- ---------------------------------------------------------------------------

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
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = v_inv.tenant_id AND t.property_id = v_inv.property_id AND t.user_id = v_uid) THEN
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

-- ---------------------------------------------------------------------------
-- RPC: create_invoice_from_lease (RENT type + period dedupe)
-- ---------------------------------------------------------------------------

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
  v_uid uuid := auth.uid();
  v_lease public.leases %ROWTYPE;
  v_period text;
  v_dup uuid;
  v_inv_id uuid;
  v_num text;
  v_due_dom int;
  v_due_ts timestamptz;
  v_month_start timestamptz;
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
  v_period := public.invoice_period_from_timestamptz(v_month_start);
  SELECT i.id INTO v_dup FROM public.invoices i
  WHERE i.user_id = v_uid
    AND i.lease_id = v_lease.id
    AND i.invoice_type = 'RENT'::public.app_invoice_type
    AND i.invoice_period = v_period
    AND i.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
  LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'An invoice already exists for this lease in this billing period.',
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
    user_id, property_id, tenant_id, lease_id, unit_id,
    invoice_number, invoice_type, invoice_period,
    invoice_date, issue_date, due_date, status,
    subtotal, tax_amount, total, total_amount, balance_due, notes
  )
  VALUES (
    v_uid, p_property_id, v_lease.tenant_id, v_lease.id, v_lease.unit_id,
    v_num, 'RENT'::public.app_invoice_type, v_period,
    v_month_start, v_month_start, v_due_ts, 'DRAFT'::public.app_invoice_status,
    v_lease.monthly_rent, 0, v_lease.monthly_rent, v_lease.monthly_rent, v_lease.monthly_rent, NULL
  )
  RETURNING id INTO v_inv_id;
  INSERT INTO public.invoice_line_items (invoice_id, description, category, quantity, unit_price, total, sort_order)
  VALUES (v_inv_id, 'Monthly rent', 'RENT'::public.app_property_income_category, 1, v_lease.monthly_rent, v_lease.monthly_rent, 1);
  RETURN jsonb_build_object('ok', true, 'invoiceId', v_inv_id::text);
END;
$$;

