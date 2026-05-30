-- Portfolio directory RPCs: properties, tenants, leases — server-side filter/sort/pagination.

CREATE OR REPLACE FUNCTION public.lease_display_status (
  p_status text,
  p_fixed_term_end date
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_status, '') IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN p_status
    WHEN p_status = 'ACTIVE'
      AND p_fixed_term_end IS NOT NULL
      AND p_fixed_term_end < CURRENT_DATE THEN 'MONTH_TO_MONTH'
    ELSE coalesce(p_status, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_lease_status (p_display_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_display_status, '') IN ('ACTIVE', 'MONTH_TO_MONTH');
$$;

CREATE OR REPLACE FUNCTION public.recurring_expense_monthly_amount (
  p_amount double precision,
  p_frequency text
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(coalesce(p_frequency, 'MONTHLY'))
    WHEN 'WEEKLY' THEN coalesce(p_amount, 0) * (52.0 / 12.0)
    WHEN 'QUARTERLY' THEN coalesce(p_amount, 0) / 3.0
    WHEN 'ANNUALLY' THEN coalesce(p_amount, 0) / 12.0
    WHEN 'YEARLY' THEN coalesce(p_amount, 0) / 12.0
    ELSE coalesce(p_amount, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.effective_property_unit_count (
  p_structure_type_id text,
  p_saved_unit_count integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_saved_unit_count IS NOT NULL AND p_saved_unit_count > 0 THEN p_saved_unit_count
    WHEN coalesce(p_structure_type_id, 'single_family_house') IN ('vacant_land', 'land', 'plot') THEN 0
    WHEN coalesce(p_structure_type_id, '') IN ('duplex') THEN 2
    WHEN coalesce(p_structure_type_id, '') IN ('triplex') THEN 3
    WHEN coalesce(p_structure_type_id, '') IN ('fourplex') THEN 4
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.derive_property_occupancy_code (
  p_structure_type_id text,
  p_active_lease_count integer,
  p_total_unit_count integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_active_lease_count, 0) <= 0 THEN 'VACANT'
    WHEN coalesce(p_total_unit_count, 0) <= 1
      OR coalesce(p_structure_type_id, 'single_family_house') IN (
        'single_family_house',
        'townhouse',
        'condo',
        'short_term_rental',
        'short_term'
      ) THEN 'OCCUPIED'
    WHEN coalesce(p_active_lease_count, 0) >= greatest(coalesce(p_total_unit_count, 1), 1) THEN 'OCCUPIED'
    ELSE 'PARTIALLY_OCCUPIED'
  END;
$$;

CREATE OR REPLACE FUNCTION public.occupancy_code_to_tenant_status (p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(p_code, 'VACANT')
    WHEN 'OCCUPIED' THEN 'Occupied'
    WHEN 'PARTIALLY_OCCUPIED' THEN 'Partially rented'
    ELSE 'Vacant'
  END;
$$;

CREATE OR REPLACE FUNCTION public.derive_tenant_lease_status (
  p_status text,
  p_fixed_term_end date,
  p_today date DEFAULT CURRENT_DATE
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

  v_display := public.lease_display_status(p_status, p_fixed_term_end);

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

CREATE OR REPLACE FUNCTION public.derive_tenant_payment_status (
  p_has_current_lease boolean,
  p_unpaid_count bigint,
  p_overdue_count bigint
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NOT coalesce(p_has_current_lease, FALSE) THEN 'unknown'
    WHEN coalesce(p_unpaid_count, 0) <= 0 THEN 'paid'
    WHEN coalesce(p_overdue_count, 0) > 0 THEN 'overdue'
    WHEN coalesce(p_unpaid_count, 0) > 1 THEN 'partial'
    ELSE 'pending'
  END;
$$;

CREATE OR REPLACE FUNCTION public.derive_lease_lifecycle_status (
  p_status text,
  p_fixed_term_end date,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.derive_tenant_lease_status(p_status, p_fixed_term_end, p_today);
$$;

-- ---------------------------------------------------------------------------
-- Properties directory
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_properties_directory (
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'RECENT'
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
  v_type text := nullif(trim(coalesce(p_type, '')), '');
  v_status text := upper(nullif(trim(coalesce(p_status, '')), ''));
  v_sort text := upper(nullif(trim(coalesce(p_sort, '')), ''));
  v_pattern text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
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
  IF v_sort IS NULL OR v_sort = '' THEN
    v_sort := 'RECENT';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  WITH unit_counts AS (
    SELECT
      pu.property_id,
      count(*)::integer AS saved_unit_count
    FROM public.property_units pu
    WHERE
      pu.user_id = v_uid
      AND pu.is_active = TRUE
    GROUP BY pu.property_id
  ),
  lease_stats AS (
    SELECT
      l.property_id,
      count(*) FILTER (
        WHERE public.is_current_lease_status(
          public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
        )
      )::integer AS active_lease_count,
      coalesce(
        sum(l.monthly_rent) FILTER (
          WHERE public.is_current_lease_status(
            public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
          )
        ),
        0
      ) AS rent_roll,
      min(l.fixed_term_end_date::date) FILTER (
        WHERE public.is_current_lease_status(
          public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
        )
      ) AS earliest_lease_end,
      bool_or(
        public.lease_display_status(l.status::text, l.fixed_term_end_date::date) = 'MONTH_TO_MONTH'
      ) AS lease_month_to_month,
      bool_or(
        l.fixed_term_end_date IS NOT NULL
        AND l.fixed_term_end_date::date >= CURRENT_DATE
        AND l.fixed_term_end_date::date <= (CURRENT_DATE + 30)
        AND public.is_current_lease_status(
          public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
        )
      ) AS lease_expiring_soon
    FROM public.leases l
    WHERE l.user_id = v_uid
    GROUP BY l.property_id
  ),
  recurring_stats AS (
    SELECT
      e.property_id,
      coalesce(
        sum(public.recurring_expense_monthly_amount(e.amount, e.recurring_frequency::text)),
        0
      ) AS recurring_monthly
    FROM public.expense_entries e
    WHERE
      e.user_id = v_uid
      AND e.is_recurring = TRUE
      AND e.recurring_schedule_parent_id IS NULL
      AND e.status <> 'ARCHIVED'::public.app_property_expense_status
      AND e.category <> 'BOND_PAYMENT'::public.app_property_expense_category
    GROUP BY e.property_id
  ),
  bond_stats AS (
    SELECT
      b.property_id,
      coalesce(sum(greatest(coalesce(b.monthly_payment, 0), 0)), 0) AS additional_bond_monthly
    FROM public.property_additional_bonds b
    WHERE
      b.user_id = v_uid
      AND b.is_active = TRUE
    GROUP BY b.property_id
  ),
  overdue_props AS (
    SELECT DISTINCT l.property_id
    FROM public.invoices i
    INNER JOIN public.leases l ON l.id = i.lease_id
    WHERE
      i.user_id = v_uid
      AND i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
      AND i.due_date::date < CURRENT_DATE
  ),
  enriched AS (
    SELECT
      p.*,
      coalesce(ls.active_lease_count, 0) AS active_lease_count,
      coalesce(ls.rent_roll, 0) AS rent_roll,
      ls.earliest_lease_end,
      coalesce(ls.lease_month_to_month, FALSE) AS lease_month_to_month,
      coalesce(ls.lease_expiring_soon, FALSE) AS lease_expiring_soon,
      coalesce(rs.recurring_monthly, 0) AS recurring_monthly,
      coalesce(bs.additional_bond_monthly, 0) AS additional_bond_monthly,
      (op.property_id IS NOT NULL) AS rent_overdue,
      public.effective_property_unit_count(p.structure_type_id, uc.saved_unit_count) AS total_unit_count,
      public.derive_property_occupancy_code(
        p.structure_type_id,
        coalesce(ls.active_lease_count, 0),
        public.effective_property_unit_count(p.structure_type_id, uc.saved_unit_count)
      ) AS occupancy_code,
      CASE
        WHEN coalesce(ls.rent_roll, 0) > 0 THEN coalesce(ls.rent_roll, 0)
        ELSE greatest(coalesce(p.expected_monthly_income, 0), 0)
      END AS monthly_income,
      CASE
        WHEN coalesce(rs.recurring_monthly, 0) > 0 THEN coalesce(rs.recurring_monthly, 0)
        ELSE greatest(coalesce(p.expected_monthly_expenses, 0), 0)
      END AS monthly_operating_expenses,
      greatest(coalesce(p.monthly_bond_payment, 0), 0) + coalesce(bs.additional_bond_monthly, 0) AS monthly_debt_service
    FROM public.properties p
    LEFT JOIN unit_counts uc ON uc.property_id = p.id
    LEFT JOIN lease_stats ls ON ls.property_id = p.id
    LEFT JOIN recurring_stats rs ON rs.property_id = p.id
    LEFT JOIN bond_stats bs ON bs.property_id = p.id
    LEFT JOIN overdue_props op ON op.property_id = p.id
    WHERE
      p.user_id = v_uid
      AND (
        v_search IS NULL
        OR p.name ILIKE v_pattern
        OR p.address_line1 ILIKE v_pattern
        OR p.city ILIKE v_pattern
      )
      AND (
        v_type IS NULL
        OR v_type = 'ALL'
        OR p.investment_type::text = v_type
      )
      AND (
        v_status IS NULL
        OR v_status = 'ALL'
        OR (v_status = 'LAND' AND p.investment_type::text = 'VACANT_LAND')
        OR (v_status = 'STR' AND p.investment_type::text = 'SHORT_TERM_RENTAL')
        OR (v_status = 'RENOVATION' AND p.investment_type::text IN ('FLIP', 'BRRRR'))
      )
  ),
  filtered AS (
    SELECT *
    FROM enriched e
    WHERE
      v_status IS NULL
      OR v_status = 'ALL'
      OR v_status IN ('LAND', 'STR', 'RENOVATION')
      OR (v_status = 'OCCUPIED' AND e.occupancy_code = 'OCCUPIED')
      OR (v_status = 'PARTIALLY_OCCUPIED' AND e.occupancy_code = 'PARTIALLY_OCCUPIED')
      OR (
        v_status = 'VACANT'
        AND e.occupancy_code = 'VACANT'
        AND coalesce(e.investment_type::text, '') <> 'VACANT_LAND'
      )
  ),
  sorted AS (
    SELECT
      f.*,
      (f.monthly_income - f.monthly_operating_expenses) AS monthly_noi,
      (f.monthly_income - f.monthly_operating_expenses - f.monthly_debt_service) AS net_cash_flow,
      CASE
        WHEN f.current_estimated_value IS NOT NULL AND f.outstanding_bond_balance IS NOT NULL
          THEN f.current_estimated_value - f.outstanding_bond_balance
        ELSE NULL
      END AS equity_value
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort = 'HIGHEST_NOI' THEN (f.monthly_income - f.monthly_operating_expenses) END DESC NULLS LAST,
      CASE WHEN v_sort = 'HIGHEST_EQUITY' THEN
        CASE
          WHEN f.current_estimated_value IS NOT NULL AND f.outstanding_bond_balance IS NOT NULL
            THEN f.current_estimated_value - f.outstanding_bond_balance
          ELSE NULL
        END
      END DESC NULLS LAST,
      CASE WHEN v_sort = 'HIGHEST_CASH' THEN (f.monthly_income - f.monthly_operating_expenses - f.monthly_debt_service) END DESC NULLS LAST,
      CASE WHEN v_sort = 'LOWEST_CASH' THEN (f.monthly_income - f.monthly_operating_expenses - f.monthly_debt_service) END ASC NULLS LAST,
      CASE WHEN v_sort = 'URGENT_EXPIRIES' THEN f.earliest_lease_end END ASC NULLS LAST,
      CASE WHEN v_sort = 'OVERDUE_RENT' THEN CASE WHEN f.rent_overdue THEN 1 ELSE 0 END END DESC,
      f.created_at DESC,
      f.id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM filtered),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'row', to_jsonb(s) - 'active_lease_count' - 'rent_roll' - 'earliest_lease_end'
              - 'lease_month_to_month' - 'lease_expiring_soon' - 'recurring_monthly'
              - 'additional_bond_monthly' - 'rent_overdue' - 'total_unit_count' - 'occupancy_code'
              - 'monthly_income' - 'monthly_operating_expenses' - 'monthly_debt_service'
              - 'monthly_noi' - 'net_cash_flow' - 'equity_value',
            'occupancyStatus', s.occupancy_code,
            'tenantStatus', public.occupancy_code_to_tenant_status(s.occupancy_code),
            'leasedUnitCount', s.active_lease_count,
            'activeUnitCount', s.total_unit_count,
            'combinedMonthlyLeaseRent', s.rent_roll,
            'monthlyRent', s.rent_roll,
            'monthlyIncome', s.monthly_income,
            'monthlyOperatingExpenses', s.monthly_operating_expenses,
            'monthlyDebtService', s.monthly_debt_service,
            'monthlyExpenses', s.monthly_operating_expenses + s.monthly_debt_service,
            'monthlyNOI', s.monthly_noi,
            'monthlyCashFlowAfterDebtService', s.net_cash_flow,
            'netCashFlow', s.net_cash_flow,
            'rentOverdue', s.rent_overdue,
            'leaseExpiringSoon', s.lease_expiring_soon,
            'leaseMonthToMonth', s.lease_month_to_month,
            'currentLeases', CASE
              WHEN s.earliest_lease_end IS NULL THEN '[]'::jsonb
              ELSE jsonb_build_array(jsonb_build_object('fixedTermEndDate', to_char(s.earliest_lease_end, 'YYYY-MM-DD"T00:00:00.000Z"')))
            END
          )
          ORDER BY s.created_at DESC, s.id ASC
        )
        FROM sorted s
      ),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object('items', coalesce(v_items, '[]'::jsonb), 'totalCount', coalesce(v_total, 0));
END;
$function$;

-- ---------------------------------------------------------------------------
-- Tenants directory
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tenants_directory (
  p_limit integer DEFAULT 6,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_lease_status text DEFAULT NULL,
  p_payment_status text DEFAULT NULL,
  p_tab text DEFAULT 'tenants'
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
  v_lease_status text := nullif(trim(coalesce(p_lease_status, '')), '');
  v_payment_status text := nullif(trim(coalesce(p_payment_status, '')), '');
  v_tab text := lower(nullif(trim(coalesce(p_tab, '')), ''));
  v_pattern text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_metrics jsonb;
  v_applicant_metrics jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 6;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;
  IF v_tab IS NULL OR v_tab = '' THEN
    v_tab := 'tenants';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(v_search, '%', '\%') || '%';
  END IF;

  WITH invoice_stats AS (
    SELECT
      i.tenant_id,
      count(*) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
      )::bigint AS unpaid_count,
      count(*) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
          AND i.due_date::date < CURRENT_DATE
      )::bigint AS overdue_count,
      coalesce(
        sum(i.total) FILTER (
          WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
        ),
        0
      ) AS outstanding_amount,
      min(i.due_date) FILTER (
        WHERE i.status NOT IN ('PAID'::public.app_invoice_status, 'CANCELLED'::public.app_invoice_status)
      ) AS next_due_date,
      max(i.paid_at) FILTER (WHERE i.status = 'PAID'::public.app_invoice_status) AS last_paid_at
    FROM public.invoices i
    WHERE i.user_id = v_uid
    GROUP BY i.tenant_id
  ),
  current_leases AS (
    SELECT DISTINCT ON (l.tenant_id)
      l.id,
      l.tenant_id,
      l.property_id,
      l.start_date,
      l.fixed_term_end_date,
      l.monthly_rent,
      l.status,
      p.name AS property_name,
      p.address_line1,
      p.address_line2,
      p.suburb,
      p.city
    FROM public.leases l
    INNER JOIN public.properties p ON p.id = l.property_id
    WHERE l.user_id = v_uid
    ORDER BY
      l.tenant_id,
      CASE
        WHEN public.is_current_lease_status(
          public.lease_display_status(l.status::text, l.fixed_term_end_date::date)
        ) THEN 0
        ELSE 1
      END,
      l.start_date DESC NULLS LAST,
      l.created_at DESC
  ),
  base AS (
    SELECT
      t.*,
      tp.name AS linked_property_name,
      tp.address_line1 AS linked_address_line1,
      tp.address_line2 AS linked_address_line2,
      tp.suburb AS linked_suburb,
      tp.city AS linked_city,
      ap.name AS applied_property_name,
      ap.address_line1 AS applied_address_line1,
      ap.address_line2 AS applied_address_line2,
      ap.suburb AS applied_suburb,
      ap.city AS applied_city,
      cl.id AS lease_id,
      cl.property_id AS lease_property_id,
      cl.start_date AS lease_start_date,
      cl.fixed_term_end_date AS lease_end_date,
      cl.monthly_rent AS lease_monthly_rent,
      cl.status AS lease_status_raw,
      cl.property_name AS lease_property_name,
      cl.address_line1 AS lease_address_line1,
      cl.address_line2 AS lease_address_line2,
      cl.suburb AS lease_suburb,
      cl.city AS lease_city,
      coalesce(is_stats.unpaid_count, 0) AS unpaid_count,
      coalesce(is_stats.overdue_count, 0) AS overdue_count,
      coalesce(is_stats.outstanding_amount, 0) AS outstanding_amount,
      is_stats.next_due_date,
      is_stats.last_paid_at,
      public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date) AS lease_display_status,
      public.is_current_lease_status(
        public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date)
      ) AS has_current_lease,
      public.derive_tenant_lease_status(cl.status::text, cl.fixed_term_end_date::date) AS derived_lease_status,
      public.derive_tenant_payment_status(
        public.is_current_lease_status(
          public.lease_display_status(cl.status::text, cl.fixed_term_end_date::date)
        ),
        coalesce(is_stats.unpaid_count, 0),
        coalesce(is_stats.overdue_count, 0)
      ) AS derived_payment_status,
      aad.monthly_income AS applicant_monthly_income,
      aad.fit_score AS applicant_fit_score,
      aad.target_rent AS applicant_target_rent,
      aad.submitted_at AS applicant_submitted_at
    FROM public.tenants t
    LEFT JOIN public.properties tp ON tp.id = t.property_id
    LEFT JOIN public.properties ap ON ap.id = t.applied_property_id
    LEFT JOIN current_leases cl ON cl.tenant_id = t.id
    LEFT JOIN invoice_stats is_stats ON is_stats.tenant_id = t.id
    LEFT JOIN public.applicant_application_details aad ON aad.tenant_id = t.id AND aad.user_id = v_uid
    WHERE
      t.user_id = v_uid
      AND (
        v_tab = 'applicants' AND t.status = 'APPLICANT'::public.app_tenant_status
        OR v_tab <> 'applicants' AND t.status <> 'APPLICANT'::public.app_tenant_status
      )
      AND (p_property_id IS NULL OR coalesce(cl.property_id, t.property_id, t.applied_property_id) = p_property_id)
      AND (
        v_search IS NULL
        OR t.first_name ILIKE v_pattern
        OR t.last_name ILIKE v_pattern
        OR t.email ILIKE v_pattern
        OR t.phone ILIKE v_pattern
        OR coalesce(cl.property_name, tp.name, ap.name, '') ILIKE v_pattern
        OR coalesce(cl.address_line1, tp.address_line1, ap.address_line1, '') ILIKE v_pattern
        OR coalesce(cl.suburb, tp.suburb, ap.suburb, '') ILIKE v_pattern
        OR coalesce(cl.city, tp.city, ap.city, '') ILIKE v_pattern
      )
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE
      (v_lease_status IS NULL OR v_lease_status = 'ALL' OR b.derived_lease_status = v_lease_status)
      AND (v_payment_status IS NULL OR v_payment_status = 'ALL' OR b.derived_payment_status = v_payment_status)
  ),
  metrics AS (
    SELECT
      count(*)::integer AS total_tenants,
      count(*) FILTER (
        WHERE derived_lease_status IN ('active', 'ending_soon', 'notice')
      )::integer AS active_leases,
      count(*) FILTER (
        WHERE derived_payment_status IN ('overdue', 'pending', 'partial')
      )::integer AS pending_payments_count,
      coalesce(
        sum(outstanding_amount) FILTER (
          WHERE derived_payment_status IN ('overdue', 'pending', 'partial')
        ),
        0
      ) AS pending_payments_total,
      count(*) FILTER (
        WHERE lease_end_date IS NOT NULL
          AND lease_end_date::date >= CURRENT_DATE
          AND lease_end_date::date <= (CURRENT_DATE + 30)
          AND derived_lease_status IN ('active', 'ending_soon')
      )::integer AS renewals_due,
      count(*) FILTER (WHERE status = 'APPLICANT'::public.app_tenant_status)::integer AS total_applicants,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND property_id IS NULL
          AND applied_property_id IS NULL
          AND lease_property_id IS NULL
      )::integer AS awaiting_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(lease_property_id, property_id, applied_property_id) IS NOT NULL
      )::integer AS linked_to_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(lease_property_id, property_id, applied_property_id) IS NOT NULL
          AND lease_id IS NULL
      )::integer AS ready_for_lease
    FROM base
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC, id ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    (SELECT count(*)::integer FROM filtered),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pr.id::text,
            'firstName', pr.first_name,
            'lastName', pr.last_name,
            'fullName', btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
            'email', pr.email,
            'phone', pr.phone,
            'avatarUrl', NULL,
            'tenantStatus', pr.status::text,
            'propertyId', coalesce(pr.lease_property_id, pr.property_id, pr.applied_property_id)::text,
            'propertyName', coalesce(pr.lease_property_name, pr.linked_property_name, pr.applied_property_name),
            'propertyAddress', nullif(
              btrim(
                concat_ws(
                  ', ',
                  coalesce(pr.lease_address_line1, pr.linked_address_line1, pr.applied_address_line1),
                  coalesce(pr.lease_suburb, pr.linked_suburb, pr.applied_suburb),
                  coalesce(pr.lease_city, pr.linked_city, pr.applied_city)
                )
              ),
              ''
            ),
            'unitNumber', coalesce(pr.lease_address_line2, pr.linked_address_line2, pr.applied_address_line2),
            'leaseId', pr.lease_id::text,
            'monthlyRent', pr.lease_monthly_rent,
            'leaseStartDate', CASE WHEN pr.lease_start_date IS NULL THEN NULL ELSE to_char(pr.lease_start_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'leaseEndDate', CASE WHEN pr.lease_end_date IS NULL THEN NULL ELSE to_char(pr.lease_end_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'leaseStatus', pr.derived_lease_status,
            'leaseDisplayStatus', pr.lease_display_status,
            'paymentStatus', pr.derived_payment_status,
            'outstandingAmount', CASE WHEN pr.outstanding_amount > 0 THEN pr.outstanding_amount ELSE NULL END,
            'lastPaymentDate', CASE WHEN pr.last_paid_at IS NULL THEN NULL ELSE to_char(pr.last_paid_at, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'nextPaymentDueDate', CASE WHEN pr.next_due_date IS NULL THEN NULL ELSE to_char(pr.next_due_date, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'monthlyIncome', pr.applicant_monthly_income,
            'fitScore', pr.applicant_fit_score,
            'targetRent', pr.applicant_target_rent,
            'applicationSubmittedAt', CASE WHEN pr.applicant_submitted_at IS NULL THEN NULL ELSE to_char(pr.applicant_submitted_at, 'YYYY-MM-DD"T00:00:00.000Z"') END
          )
          ORDER BY pr.created_at DESC, pr.id ASC
        )
        FROM page_rows pr
      ),
      '[]'::jsonb
    ),
    (
      SELECT jsonb_build_object(
        'totalTenants', m.total_tenants,
        'activeLeases', m.active_leases,
        'pendingPaymentsTotal', m.pending_payments_total,
        'pendingPaymentsCount', m.pending_payments_count,
        'renewalsDue', m.renewals_due
      )
      FROM metrics m
    ),
    (
      SELECT jsonb_build_object(
        'totalApplicants', m.total_applicants,
        'awaitingProperty', m.awaiting_property,
        'linkedToProperty', m.linked_to_property,
        'readyForLease', m.ready_for_lease
      )
      FROM metrics m
    )
  INTO v_total, v_items, v_metrics, v_applicant_metrics
  FROM metrics
  LIMIT 1;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total, 0),
    'metrics', coalesce(v_metrics, '{}'::jsonb),
    'applicantMetrics', coalesce(v_applicant_metrics, '{}'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Leases directory
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_leases_directory (
  p_limit integer DEFAULT 6,
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
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_lease_type text := upper(nullif(trim(coalesce(p_lease_type, '')), ''));
  v_pattern text;
  v_today date := CURRENT_DATE;
  v_in30 date := CURRENT_DATE + 30;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_metrics jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 6;
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
      public.lease_display_status(l.status::text, l.fixed_term_end_date::date) AS display_status,
      public.derive_lease_lifecycle_status(l.status::text, l.fixed_term_end_date::date, v_today) AS lifecycle_status
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
        OR v_status = 'ALL'
        OR (v_status = 'expired' AND l.status::text IN ('EXPIRED', 'TERMINATED', 'CANCELLED'))
        OR (
          v_status = 'inactive'
          AND l.status::text NOT IN ('ACTIVE', 'MONTH_TO_MONTH', 'EXPIRED', 'TERMINATED', 'CANCELLED')
        )
        OR (
          v_status = 'notice'
          AND l.status::text = 'ACTIVE'
          AND l.fixed_term_end_date IS NOT NULL
          AND l.fixed_term_end_date::date < v_today
        )
        OR (
          v_status = 'ending_soon'
          AND l.status::text IN ('ACTIVE', 'MONTH_TO_MONTH')
          AND l.fixed_term_end_date IS NOT NULL
          AND l.fixed_term_end_date::date >= v_today
          AND l.fixed_term_end_date::date <= v_in30
        )
        OR (
          v_status = 'active'
          AND l.status::text IN ('ACTIVE', 'MONTH_TO_MONTH')
          AND (
            l.fixed_term_end_date IS NULL
            OR l.fixed_term_end_date::date > v_in30
            OR l.status::text = 'MONTH_TO_MONTH'
          )
          AND NOT (
            l.status::text = 'ACTIVE'
            AND l.fixed_term_end_date IS NOT NULL
            AND l.fixed_term_end_date::date < v_today
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
        OR public.lease_display_status(l.status::text, l.fixed_term_end_date::date) ILIKE v_pattern
      )
  ),
  metrics AS (
    SELECT
      count(*)::integer AS total_leases,
      count(*) FILTER (
        WHERE lifecycle_status IN ('active', 'ending_soon', 'notice')
          OR public.is_current_lease_status(display_status)
      )::integer AS active_leases,
      coalesce(
        sum(monthly_rent) FILTER (
          WHERE lifecycle_status IN ('active', 'ending_soon', 'notice')
            OR public.is_current_lease_status(display_status)
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

GRANT EXECUTE ON FUNCTION public.lease_display_status (text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_lease_status (text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recurring_expense_monthly_amount (double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_property_unit_count (text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_property_occupancy_code (text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.occupancy_code_to_tenant_status (text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_tenant_lease_status (text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_tenant_payment_status (boolean, bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.derive_lease_lifecycle_status (text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_properties_directory (integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenants_directory (integer, integer, text, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leases_directory (integer, integer, text, uuid, text, text) TO authenticated;
