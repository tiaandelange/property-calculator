-- Tenants directory: resolve leases for co-tenants via lease_tenants; dedupe lease metrics.

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
  tenant_lease_links AS (
    SELECT
      l.id,
      l.tenant_id AS link_tenant_id,
      l.tenant_id AS lease_primary_tenant_id,
      l.property_id,
      l.start_date,
      l.fixed_term_end_date,
      l.monthly_rent,
      l.status,
      p.name AS property_name,
      p.address_line1,
      p.address_line2,
      p.suburb,
      p.city,
      l.created_at,
      false AS is_co_tenant
    FROM public.leases l
    INNER JOIN public.properties p ON p.id = l.property_id
    WHERE l.user_id = v_uid

    UNION ALL

    SELECT
      l.id,
      lt.tenant_id AS link_tenant_id,
      l.tenant_id AS lease_primary_tenant_id,
      l.property_id,
      l.start_date,
      l.fixed_term_end_date,
      l.monthly_rent,
      l.status,
      p.name AS property_name,
      p.address_line1,
      p.address_line2,
      p.suburb,
      p.city,
      l.created_at,
      true AS is_co_tenant
    FROM public.lease_tenants lt
    INNER JOIN public.leases l ON l.id = lt.lease_id AND l.user_id = v_uid
    INNER JOIN public.properties p ON p.id = l.property_id
    WHERE lt.user_id = v_uid
      AND lt.tenant_id <> l.tenant_id
  ),
  current_leases AS (
    SELECT DISTINCT ON (tll.link_tenant_id)
      tll.id,
      tll.link_tenant_id AS tenant_id,
      tll.lease_primary_tenant_id,
      tll.is_co_tenant,
      tll.property_id,
      tll.start_date,
      tll.fixed_term_end_date,
      tll.monthly_rent,
      tll.status,
      tll.property_name,
      tll.address_line1,
      tll.address_line2,
      tll.suburb,
      tll.city
    FROM tenant_lease_links tll
    ORDER BY
      tll.link_tenant_id,
      CASE
        WHEN public.is_current_lease_status(
          public.lease_display_status(tll.status::text, tll.fixed_term_end_date::date)
        ) THEN 0
        ELSE 1
      END,
      CASE WHEN tll.is_co_tenant THEN 1 ELSE 0 END,
      tll.start_date DESC NULLS LAST,
      tll.created_at DESC
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
      coalesce(cl.is_co_tenant, false) AS is_co_tenant,
      cl.lease_primary_tenant_id,
      nullif(btrim(concat_ws(' ', primary_t.first_name, primary_t.last_name)), '') AS primary_tenant_name,
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
    LEFT JOIN public.tenants primary_t ON primary_t.id = cl.lease_primary_tenant_id AND cl.is_co_tenant
    LEFT JOIN invoice_stats is_stats ON is_stats.tenant_id = CASE
      WHEN coalesce(cl.is_co_tenant, false) THEN cl.lease_primary_tenant_id
      ELSE t.id
    END
    LEFT JOIN public.applicant_application_details aad ON aad.tenant_id = CASE WHEN t.applicant_group_role = 'CO' AND t.application_group_id IS NOT NULL THEN
      public.applicant_group_primary_tenant_id(t.application_group_id)
    ELSE
      t.id
    END
      AND aad.user_id = v_uid
    WHERE
      t.user_id = v_uid
      AND (
        v_tab = 'applicants' AND t.status = 'APPLICANT'::public.app_tenant_status
        OR v_tab <> 'applicants' AND t.status <> 'APPLICANT'::public.app_tenant_status
      )
      AND (
        v_tab <> 'applicants'
        OR coalesce(t.applicant_group_role, 'PRIMARY') <> 'CO'
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
        OR (
          v_tab = 'applicants'
          AND EXISTS (
            SELECT
              1
            FROM
              public.tenants co_s
            WHERE
              co_s.application_group_id = t.application_group_id
              AND co_s.applicant_group_role = 'CO'
              AND co_s.user_id = v_uid
              AND (
                co_s.first_name ILIKE v_pattern
                OR co_s.last_name ILIKE v_pattern
                OR coalesce(co_s.email, '') ILIKE v_pattern
                OR coalesce(co_s.phone, '') ILIKE v_pattern))
        )
      )
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE
      (v_lease_status IS NULL OR v_lease_status = 'ALL' OR b.derived_lease_status = v_lease_status)
      AND (v_payment_status IS NULL OR v_payment_status = 'ALL' OR b.derived_payment_status = v_payment_status)
  ),
  lease_payment_rollups AS (
    SELECT DISTINCT ON (b.lease_id)
      b.lease_id,
      b.derived_payment_status,
      b.outstanding_amount
    FROM base b
    WHERE b.lease_id IS NOT NULL
      AND b.derived_payment_status IN ('overdue', 'pending', 'partial')
    ORDER BY b.lease_id, b.outstanding_amount DESC NULLS LAST
  ),
  metrics AS (
    SELECT
      count(*)::integer AS total_tenants,
      (
        SELECT count(DISTINCT b.lease_id)::integer
        FROM base b
        WHERE b.lease_id IS NOT NULL
          AND b.derived_lease_status IN ('active', 'ending_soon', 'notice')
      ) AS active_leases,
      (SELECT count(*)::integer FROM lease_payment_rollups) AS pending_payments_count,
      (SELECT coalesce(sum(outstanding_amount), 0) FROM lease_payment_rollups) AS pending_payments_total,
      (
        SELECT count(DISTINCT b.lease_id)::integer
        FROM base b
        WHERE b.lease_id IS NOT NULL
          AND b.lease_end_date IS NOT NULL
          AND b.lease_end_date::date >= CURRENT_DATE
          AND b.lease_end_date::date <= (CURRENT_DATE + 30)
          AND b.derived_lease_status IN ('active', 'ending_soon')
      ) AS renewals_due,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
      )::integer AS total_applicants,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
          AND property_id IS NULL
          AND applied_property_id IS NULL
          AND lease_property_id IS NULL
      )::integer AS awaiting_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
          AND coalesce(lease_property_id, property_id, applied_property_id) IS NOT NULL
      )::integer AS linked_to_property,
      count(*) FILTER (
        WHERE status = 'APPLICANT'::public.app_tenant_status
          AND coalesce(applicant_group_role, 'PRIMARY') <> 'CO'
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
            'fullName', CASE WHEN v_tab = 'applicants' THEN
              public.applicant_display_full_name(pr.first_name, pr.last_name, co_pr.first_name, co_pr.last_name)
            ELSE
              btrim(concat_ws(' ', pr.first_name, pr.last_name))
            END,
            'email', CASE WHEN v_tab = 'applicants' AND co_pr.id IS NOT NULL AND coalesce(pr.email, '') <> '' AND coalesce(co_pr.email, '') <> '' THEN
              pr.email || ' & ' || co_pr.email
            WHEN v_tab = 'applicants' AND co_pr.id IS NOT NULL AND coalesce(co_pr.email, '') <> '' THEN
              co_pr.email
            ELSE
              public.tenant_contact_field(pr.email, pr.applicant_group_role::text)
            END,
            'phone', CASE WHEN v_tab = 'applicants' AND co_pr.id IS NOT NULL AND coalesce(pr.phone, '') <> '' AND coalesce(co_pr.phone, '') <> '' THEN
              pr.phone || ' & ' || co_pr.phone
            WHEN v_tab = 'applicants' AND co_pr.id IS NOT NULL AND coalesce(co_pr.phone, '') <> '' THEN
              co_pr.phone
            ELSE
              public.tenant_contact_field(pr.phone, pr.applicant_group_role::text)
            END,
            'avatarUrl', NULL,
            'tenantStatus', pr.status::text,
            'applicantGroupRole', pr.applicant_group_role::text,
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
            'applicationSubmittedAt', CASE WHEN pr.applicant_submitted_at IS NULL THEN NULL ELSE to_char(pr.applicant_submitted_at, 'YYYY-MM-DD"T00:00:00.000Z"') END,
            'applicationGroupId', pr.application_group_id::text,
            'coApplicantTenantId', CASE WHEN v_tab = 'applicants' THEN co_pr.id::text ELSE NULL END,
            'memberTenantIds', CASE WHEN v_tab = 'applicants' AND co_pr.id IS NOT NULL THEN
              jsonb_build_array(pr.id::text, co_pr.id::text)
            ELSE
              jsonb_build_array(pr.id::text)
            END,
            'isCoTenant', coalesce(pr.is_co_tenant, false),
            'sharedLeaseId', pr.lease_id::text,
            'primaryTenantName', pr.primary_tenant_name
          )
          ORDER BY pr.created_at DESC, pr.id ASC
        )
        FROM page_rows pr
        LEFT JOIN public.tenants co_pr ON v_tab = 'applicants'
          AND co_pr.application_group_id = pr.application_group_id
          AND co_pr.applicant_group_role = 'CO'
          AND co_pr.user_id = v_uid
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

COMMENT ON FUNCTION public.get_tenants_directory IS
  'Paginated tenants/applicants directory. Resolves leases for primary and co-tenants via lease_tenants; lease metrics use distinct lease_id.';
