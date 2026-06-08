-- Scheduled lease cancellation: remain active until cancellation_date passes.

DROP FUNCTION IF EXISTS public.lease_display_status (text, date);
DROP FUNCTION IF EXISTS public.derive_lease_lifecycle_status (text, date, date);
DROP FUNCTION IF EXISTS public.derive_tenant_lease_status (text, date, date);

CREATE OR REPLACE FUNCTION public.lease_display_status (
  p_status text,
  p_fixed_term_end date,
  p_cancellation_date date DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_status, '') = 'CANCELLED'
      AND p_cancellation_date IS NOT NULL
      AND p_cancellation_date > CURRENT_DATE THEN
      CASE
        WHEN p_fixed_term_end IS NOT NULL AND p_fixed_term_end < CURRENT_DATE THEN 'MONTH_TO_MONTH'
        ELSE 'ACTIVE'
      END
    WHEN coalesce(p_status, '') IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN p_status
    WHEN p_status = 'ACTIVE'
      AND p_fixed_term_end IS NOT NULL
      AND p_fixed_term_end < CURRENT_DATE THEN 'MONTH_TO_MONTH'
    ELSE coalesce(p_status, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.derive_tenant_lease_status (
  p_status text,
  p_fixed_term_end date,
  p_today date DEFAULT CURRENT_DATE,
  p_cancellation_date date DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_display text;
  v_days integer;
BEGIN
  IF p_status IS NULL OR btrim(p_status) = '' THEN
    RETURN 'inactive';
  END IF;

  v_display := public.lease_display_status(p_status, p_fixed_term_end, p_cancellation_date);

  IF NOT public.is_current_lease_status(v_display) THEN
    IF v_display IN ('EXPIRED', 'TERMINATED', 'CANCELLED') THEN
      RETURN 'expired';
    END IF;
    RETURN 'inactive';
  END IF;

  IF p_fixed_term_end IS NOT NULL THEN
    v_days := (p_fixed_term_end - p_today);
    IF v_days >= 0 AND v_days <= 30 THEN
      RETURN 'ending_soon';
    END IF;
  END IF;

  IF v_display = 'MONTH_TO_MONTH' THEN
    RETURN 'notice';
  END IF;

  RETURN 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.derive_lease_lifecycle_status (
  p_status text,
  p_fixed_term_end date,
  p_today date DEFAULT CURRENT_DATE,
  p_cancellation_date date DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.derive_tenant_lease_status(p_status, p_fixed_term_end, p_today, p_cancellation_date);
$$;

CREATE OR REPLACE FUNCTION public.lease_is_invoice_eligible (p_lease public.leases, p_as_of date)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  AS $$
DECLARE
  v_display_status text;
BEGIN
  IF p_lease.cancellation_date IS NOT NULL
    AND p_lease.cancellation_date::date <= p_as_of THEN
    RETURN FALSE;
  END IF;
  v_display_status := public.lease_display_status(
    p_lease.status::text,
    p_lease.fixed_term_end_date::date,
    p_lease.cancellation_date::date
  );
  IF NOT public.is_current_lease_status(v_display_status) THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_lease (
  p_lease_id uuid,
  p_cancellation_date date,
  p_cancellation_reason text DEFAULT NULL,
  p_cancelled_by public.app_lease_cancelled_by DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_lease public.leases %ROWTYPE;
  v_cut timestamptz;
  v_scheduled boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF p_cancellation_date IS NULL THEN
    RAISE EXCEPTION 'CANCELLATION_DATE_REQUIRED';
  END IF;
  SELECT
    * INTO v_lease
  FROM
    public.leases l
  WHERE
    l.id = p_lease_id
    AND l.user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEASE_NOT_FOUND';
  END IF;
  IF v_lease.status IN ('CANCELLED', 'TERMINATED', 'ARCHIVED')
    AND (
      v_lease.cancellation_date IS NULL
      OR v_lease.cancellation_date::date <= CURRENT_DATE
    ) THEN
    RAISE EXCEPTION 'LEASE_ALREADY_CLOSED';
  END IF;
  v_cut := (p_cancellation_date::text || 'T00:00:00Z')::timestamptz;
  v_scheduled := p_cancellation_date > CURRENT_DATE;

  UPDATE
    public.income_entries i
  SET
    status = 'CANCELLED'::public.app_property_income_status,
    updated_at = now()
  WHERE
    i.lease_id = p_lease_id
    AND i.user_id = v_uid
    AND i.status = 'EXPECTED'::public.app_property_income_status
    AND i.income_date > v_cut;

  IF v_scheduled THEN
    UPDATE
      public.leases l
    SET
      cancellation_date = v_cut,
      cancellation_reason = p_cancellation_reason,
      cancelled_by = p_cancelled_by,
      updated_at = now()
    WHERE
      l.id = p_lease_id
      AND l.user_id = v_uid
    RETURNING
      * INTO v_lease;
  ELSE
    UPDATE
      public.recurring_income_rules r
    SET
      status = 'CANCELLED'::public.app_recurring_income_rule_status,
      updated_at = now()
    WHERE
      r.lease_id = p_lease_id
      AND r.user_id = v_uid;
    UPDATE
      public.leases l
    SET
      status = 'CANCELLED'::public.app_lease_status,
      cancellation_date = v_cut,
      cancellation_reason = p_cancellation_reason,
      cancelled_by = p_cancelled_by,
      updated_at = now()
    WHERE
      l.id = p_lease_id
      AND l.user_id = v_uid
    RETURNING
      * INTO v_lease;
  END IF;

  RETURN to_jsonb (v_lease);
END;
$$;

COMMENT ON FUNCTION public.cancel_lease (uuid, date, text, public.app_lease_cancelled_by) IS
  'Cancels a lease immediately or schedules cancellation for a future date. Future cancellations keep the lease active until the date passes.';

-- Patch leases directory display status to honour scheduled cancellation.
CREATE OR REPLACE FUNCTION public.get_leases_directory (
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_lease_type text DEFAULT NULL
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
  v_status text := lower(nullif(trim(coalesce(p_status, '')), ''));
  v_lease_type text := upper(nullif(trim(coalesce(p_lease_type, '')), ''));
  v_pattern text;
  v_today date := CURRENT_DATE;
  v_in30 date := CURRENT_DATE + 30;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_metrics jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 25;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  WITH base AS (
    SELECT
      l.*,
      t.first_name,
      t.last_name,
      t.email,
      t.phone,
      p.name AS property_name,
      p.address_line1,
      p.address_line2,
      p.suburb,
      p.city,
      public.lease_display_status(
        l.status::text,
        l.fixed_term_end_date::date,
        l.cancellation_date::date
      ) AS display_status,
      public.derive_lease_lifecycle_status(
        l.status::text,
        l.fixed_term_end_date::date,
        v_today,
        l.cancellation_date::date
      ) AS lifecycle_status
    FROM public.leases l
    INNER JOIN public.tenants t ON t.id = l.tenant_id
    INNER JOIN public.properties p ON p.id = l.property_id
    WHERE
      l.user_id = v_uid
      AND (p_property_id IS NULL OR l.property_id = p_property_id)
      AND (
        v_lease_type IS NULL
        OR v_lease_type = 'ALL'
        OR l.lease_type::text = v_lease_type
      )
      AND (
        v_status IS NULL
        OR v_status = 'all'
        OR (
          v_status = 'expired'
          AND public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date)
            IN ('EXPIRED', 'TERMINATED', 'CANCELLED')
        )
        OR (
          v_status = 'inactive'
          AND NOT public.is_current_lease_status(
            public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date)
          )
          AND public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date)
            NOT IN ('EXPIRED', 'TERMINATED', 'CANCELLED')
        )
        OR (
          v_status = 'notice'
          AND public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date) = 'MONTH_TO_MONTH'
        )
        OR (
          v_status = 'ending_soon'
          AND public.is_current_lease_status(
            public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date)
          )
          AND l.fixed_term_end_date IS NOT NULL
          AND l.fixed_term_end_date::date >= v_today
          AND l.fixed_term_end_date::date <= v_in30
        )
        OR (
          v_status = 'active'
          AND public.is_current_lease_status(
            public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date)
          )
          AND (
            l.fixed_term_end_date IS NULL
            OR l.fixed_term_end_date::date > v_in30
            OR public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date) = 'MONTH_TO_MONTH'
          )
        )
      )
      AND (
        v_search IS NULL
        OR l.lease_reference ILIKE v_pattern
        OR t.first_name ILIKE v_pattern
        OR t.last_name ILIKE v_pattern
        OR t.email ILIKE v_pattern
        OR p.name ILIKE v_pattern
        OR p.address_line1 ILIKE v_pattern
        OR p.suburb ILIKE v_pattern
        OR p.city ILIKE v_pattern
        OR public.lease_display_status(l.status::text, l.fixed_term_end_date::date, l.cancellation_date::date) ILIKE v_pattern
      )
  ),
  metrics AS (
    SELECT
      count(*)::integer AS total_leases,
      count(*) FILTER (
        WHERE public.is_current_lease_status(display_status)
      )::integer AS active_leases,
      coalesce(
        sum(monthly_rent) FILTER (
          WHERE public.is_current_lease_status(display_status)
        ),
        0
      ) AS monthly_rent_roll,
      count(*) FILTER (
        WHERE fixed_term_end_date IS NOT NULL
          AND fixed_term_end_date::date >= v_today
          AND fixed_term_end_date::date <= v_in30
          AND lifecycle_status IN ('active', 'ending_soon')
      )::integer AS renewals_due
    FROM base
  ),
  page_rows AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC, id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM base),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pr.id::text,
            'propertyId', pr.property_id::text,
            'propertyName', coalesce(pr.property_name, 'Unknown property'),
            'propertyAddress', nullif(btrim(concat_ws(', ', pr.address_line1, pr.suburb, pr.city)), ''),
            'tenantId', pr.tenant_id::text,
            'tenantName', coalesce(
              nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
              'Unknown tenant'
            ),
            'tenantEmail', pr.email,
            'tenantPhone', pr.phone,
            'monthlyRent', pr.monthly_rent,
            'depositAmount', pr.deposit_amount,
            'rentDueDay', pr.rent_due_day,
            'leaseType', pr.lease_type::text,
            'leaseTypeLabel', CASE WHEN pr.lease_type::text = 'MONTH_TO_MONTH' THEN 'Month-to-month' ELSE 'Fixed term' END,
            'startDate', CASE WHEN pr.start_date IS NULL THEN NULL ELSE to_char(pr.start_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'endDate', CASE WHEN pr.fixed_term_end_date IS NULL THEN NULL ELSE to_char(pr.fixed_term_end_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'displayStatus', pr.display_status,
            'lifecycleStatus', pr.lifecycle_status,
            'isCancellable', public.is_current_lease_status(pr.display_status)
          )
          ORDER BY pr.created_at DESC, pr.id ASC
        )
        FROM page_rows pr
      ),
      '[]'::jsonb
    ),
    (
      SELECT jsonb_build_object(
        'totalLeases', m.total_leases,
        'activeLeases', m.active_leases,
        'monthlyRentRoll', m.monthly_rent_roll,
        'renewalsDue', m.renewals_due
      )
      FROM metrics m
    )
  INTO v_total, v_items, v_metrics
  FROM metrics
  LIMIT 1;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0),
    'metrics', coalesce(v_metrics, '{}'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lease_display_status (text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_tenant_lease_status (text, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_lease_lifecycle_status (text, date, date, date) TO authenticated;
