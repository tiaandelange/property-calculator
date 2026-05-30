-- Invoice directory: lightweight metrics RPC + paginated list RPC (separate from metrics).

CREATE OR REPLACE FUNCTION public.invoice_directory_effective_balance (
  p_balance_due double precision,
  p_total_amount double precision,
  p_total double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_balance_due, 0) > 0 THEN p_balance_due
    ELSE coalesce(p_total_amount, p_total, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_invoice_directory_metrics (
  p_property_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := upper(nullif(trim(coalesce(p_status, '')), ''));
  v_pattern text;
  v_this_month text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  RETURN (
    WITH filtered AS (
      SELECT
        i.status,
        i.due_date,
        coalesce(i.issue_date, i.invoice_date) AS paid_reference_date,
        public.invoice_directory_effective_balance(i.balance_due, i.total_amount, i.total) AS effective_balance
      FROM public.invoices i
      LEFT JOIN public.tenants t ON t.id = i.tenant_id
      LEFT JOIN public.properties p ON p.id = i.property_id
      WHERE
        i.user_id = v_uid
        AND (p_property_id IS NULL OR i.property_id = p_property_id)
        AND (v_status IS NULL OR v_status = 'ALL' OR i.status::text = v_status)
        AND (p_date_from IS NULL OR i.due_date::date >= p_date_from)
        AND (p_date_to IS NULL OR i.due_date::date <= p_date_to)
        AND (
          v_search IS NULL
          OR i.invoice_number ILIKE v_pattern
          OR t.first_name ILIKE v_pattern
          OR t.last_name ILIKE v_pattern
          OR p.name ILIKE v_pattern
          OR i.status::text ILIKE v_pattern
        )
    )
    SELECT jsonb_build_object(
      'totalOutstanding', coalesce(
        sum(effective_balance) FILTER (
          WHERE status::text IN ('DRAFT', 'GENERATED', 'SENT', 'DUE', 'PARTIALLY_PAID', 'OVERDUE')
        ),
        0
      ),
      'dueThisMonth', coalesce(
        sum(effective_balance) FILTER (
          WHERE status::text IN ('DRAFT', 'GENERATED', 'SENT', 'DUE', 'PARTIALLY_PAID', 'OVERDUE')
            AND due_date IS NOT NULL
            AND to_char(due_date::date, 'YYYY-MM') = v_this_month
        ),
        0
      ),
      'overdue', coalesce(
        sum(effective_balance) FILTER (
          WHERE status::text NOT IN ('PAID', 'CANCELLED', 'VOID')
            AND (
              status::text = 'OVERDUE'
              OR (
                status::text IN ('DRAFT', 'GENERATED', 'SENT', 'DUE', 'PARTIALLY_PAID', 'OVERDUE')
                AND due_date IS NOT NULL
                AND due_date::date < CURRENT_DATE
              )
            )
        ),
        0
      ),
      'paidThisMonth', coalesce(
        sum(effective_balance) FILTER (
          WHERE status::text = 'PAID'
            AND paid_reference_date IS NOT NULL
            AND to_char(paid_reference_date::date, 'YYYY-MM') = v_this_month
        ),
        0
      )
    )
    FROM filtered
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoices_directory (
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_property_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_status text := upper(nullif(trim(coalesce(p_status, '')), ''));
  v_pattern text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 20;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  WITH filtered AS (
    SELECT
      i.*,
      t.id AS tenant_row_id,
      t.first_name AS tenant_first_name,
      t.last_name AS tenant_last_name,
      p.id AS property_row_id,
      p.name AS property_name,
      pu.id AS unit_row_id,
      pu.unit_name AS unit_name,
      l.id AS lease_row_id,
      l.start_date AS lease_start_date,
      l.fixed_term_end_date AS lease_fixed_term_end_date,
      l.status AS lease_status,
      l.lease_reference AS lease_reference
    FROM public.invoices i
    LEFT JOIN public.tenants t ON t.id = i.tenant_id
    LEFT JOIN public.properties p ON p.id = i.property_id
    LEFT JOIN public.property_units pu ON pu.id = i.unit_id
    LEFT JOIN public.leases l ON l.id = i.lease_id
    WHERE
      i.user_id = v_uid
      AND (p_property_id IS NULL OR i.property_id = p_property_id)
      AND (v_status IS NULL OR v_status = 'ALL' OR i.status::text = v_status)
      AND (p_date_from IS NULL OR i.due_date::date >= p_date_from)
      AND (p_date_to IS NULL OR i.due_date::date <= p_date_to)
      AND (
        v_search IS NULL
        OR i.invoice_number ILIKE v_pattern
        OR t.first_name ILIKE v_pattern
        OR t.last_name ILIKE v_pattern
        OR p.name ILIKE v_pattern
        OR i.status::text ILIKE v_pattern
      )
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY due_date DESC NULLS LAST, created_at DESC, id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM filtered),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'user_id', r.user_id,
            'property_id', r.property_id,
            'tenant_id', r.tenant_id,
            'lease_id', r.lease_id,
            'unit_id', r.unit_id,
            'invoice_number', r.invoice_number,
            'invoice_type', r.invoice_type,
            'invoice_period', r.invoice_period,
            'invoice_date', r.invoice_date,
            'issue_date', r.issue_date,
            'due_date', r.due_date,
            'status', r.status,
            'total', r.total,
            'total_amount', r.total_amount,
            'balance_due', r.balance_due,
            'paid_at', r.paid_at,
            'created_at', r.created_at,
            'pdf_storage_key', r.pdf_storage_key,
            'pdf_storage_bucket', r.pdf_storage_bucket,
            'tenants', CASE
              WHEN r.tenant_row_id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', r.tenant_row_id,
                'first_name', r.tenant_first_name,
                'last_name', r.tenant_last_name
              )
            END,
            'properties', CASE
              WHEN r.property_row_id IS NULL THEN NULL
              ELSE jsonb_build_object('id', r.property_row_id, 'name', r.property_name)
            END,
            'property_units', CASE
              WHEN r.unit_row_id IS NULL THEN NULL
              ELSE jsonb_build_object('id', r.unit_row_id, 'unit_name', r.unit_name)
            END,
            'leases', CASE
              WHEN r.lease_row_id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', r.lease_row_id,
                'start_date', r.lease_start_date,
                'fixed_term_end_date', r.lease_fixed_term_end_date,
                'status', r.lease_status,
                'lease_reference', r.lease_reference
              )
            END
          )
          ORDER BY r.due_date DESC NULLS LAST, r.created_at DESC, r.id ASC
        )
        FROM page_rows r
      ),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invoice_directory_effective_balance (double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_directory_metrics (uuid, text, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoices_directory (integer, integer, uuid, text, date, date, text) TO authenticated;
