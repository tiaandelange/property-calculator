-- Global workspace search + dashboard notification feed

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS lease_expiring_alerts_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.lease_expiring_alerts_enabled IS
  'In-app dashboard alerts when a fixed-term lease is nearing expiry.';

CREATE OR REPLACE FUNCTION public.search_workspace (
  p_query text,
  p_limit_per_kind integer DEFAULT 5
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q text := trim(coalesce(p_query, ''));
  v_lim integer := greatest(1, least(coalesce(p_limit_per_kind, 5), 10));
  v_pattern text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF char_length(v_q) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN coalesce((
    SELECT jsonb_agg(hit ORDER BY hit ->> 'kind', hit ->> 'title')
    FROM (
      SELECT jsonb_build_object(
        'kind', 'property',
        'id', p.id::text,
        'title', p.name,
        'subtitle', nullif(trim(concat_ws(', ', p.address_line1, p.city)), ''),
        'route', '/owned-properties/' || p.id::text
      ) AS hit
      FROM public.properties p
      WHERE
        p.user_id = v_uid
        AND (
          p.name ILIKE v_pattern ESCAPE '\'
          OR p.address_line1 ILIKE v_pattern ESCAPE '\'
          OR p.city ILIKE v_pattern ESCAPE '\'
          OR coalesce(p.suburb, '') ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY p.updated_at DESC
      LIMIT v_lim
    ) properties_hits
    UNION ALL
    SELECT hit FROM (
      SELECT jsonb_build_object(
        'kind', 'tenant',
        'id', t.id::text,
        'title', trim(concat_ws(' ', t.first_name, t.last_name)),
        'subtitle', coalesce(pr.name, t.email, t.phone, 'Tenant'),
        'route', '/tenants/' || t.id::text
      ) AS hit
      FROM public.tenants t
      LEFT JOIN public.properties pr ON pr.id = t.property_id
      WHERE
        t.user_id = v_uid
        AND t.status <> 'APPLICANT'
        AND (
          t.first_name ILIKE v_pattern ESCAPE '\'
          OR t.last_name ILIKE v_pattern ESCAPE '\'
          OR coalesce(t.email, '') ILIKE v_pattern ESCAPE '\'
          OR coalesce(t.phone, '') ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY t.updated_at DESC
      LIMIT v_lim
    ) tenant_hits
    UNION ALL
    SELECT hit FROM (
      SELECT jsonb_build_object(
        'kind', 'applicant',
        'id', t.id::text,
        'title', trim(concat_ws(' ', t.first_name, t.last_name)),
        'subtitle', coalesce(pr.name, t.email, 'Applicant'),
        'route', '/tenants/' || t.id::text
      ) AS hit
      FROM public.tenants t
      LEFT JOIN public.properties pr ON pr.id = t.property_id
      WHERE
        t.user_id = v_uid
        AND t.status = 'APPLICANT'
        AND (
          t.first_name ILIKE v_pattern ESCAPE '\'
          OR t.last_name ILIKE v_pattern ESCAPE '\'
          OR coalesce(t.email, '') ILIKE v_pattern ESCAPE '\'
          OR coalesce(t.phone, '') ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY t.updated_at DESC
      LIMIT v_lim
    ) applicant_hits
    UNION ALL
    SELECT hit FROM (
      SELECT jsonb_build_object(
        'kind', 'lease',
        'id', l.id::text,
        'title', coalesce(l.lease_reference, 'Lease'),
        'subtitle', nullif(trim(concat_ws(' · ', trim(concat_ws(' ', tn.first_name, tn.last_name)), pr.name)), ''),
        'route', '/owned-properties/' || l.property_id::text || '?tab=leases'
      ) AS hit
      FROM public.leases l
      JOIN public.tenants tn ON tn.id = l.tenant_id
      JOIN public.properties pr ON pr.id = l.property_id
      WHERE
        l.user_id = v_uid
        AND (
          coalesce(l.lease_reference, '') ILIKE v_pattern ESCAPE '\'
          OR tn.first_name ILIKE v_pattern ESCAPE '\'
          OR tn.last_name ILIKE v_pattern ESCAPE '\'
          OR pr.name ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY l.updated_at DESC
      LIMIT v_lim
    ) lease_hits
    UNION ALL
    SELECT hit FROM (
      SELECT jsonb_build_object(
        'kind', 'invoice',
        'id', inv.id::text,
        'title', inv.invoice_number,
        'subtitle', nullif(trim(concat_ws(' · ', trim(concat_ws(' ', tn.first_name, tn.last_name)), pr.name)), ''),
        'route', '/invoices/' || inv.id::text
      ) AS hit
      FROM public.invoices inv
      JOIN public.tenants tn ON tn.id = inv.tenant_id
      JOIN public.properties pr ON pr.id = inv.property_id
      WHERE
        inv.user_id = v_uid
        AND (
          inv.invoice_number ILIKE v_pattern ESCAPE '\'
          OR tn.first_name ILIKE v_pattern ESCAPE '\'
          OR tn.last_name ILIKE v_pattern ESCAPE '\'
          OR pr.name ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY inv.updated_at DESC
      LIMIT v_lim
    ) invoice_hits
    UNION ALL
    SELECT hit FROM (
      SELECT jsonb_build_object(
        'kind', 'report',
        'id', sr.id::text,
        'title', coalesce(nullif(trim(sr.scenario_name), ''), sr.file_name, sr.report_type),
        'subtitle', coalesce(pr.name, sr.report_type),
        'route', '/owned-properties/reports'
      ) AS hit
      FROM public.stored_reports sr
      LEFT JOIN public.properties pr ON pr.id = sr.property_id
      WHERE
        sr.user_id = v_uid
        AND (
          coalesce(sr.scenario_name, '') ILIKE v_pattern ESCAPE '\'
          OR sr.file_name ILIKE v_pattern ESCAPE '\'
          OR sr.report_type ILIKE v_pattern ESCAPE '\'
          OR coalesce(pr.name, '') ILIKE v_pattern ESCAPE '\'
        )
      ORDER BY sr.updated_at DESC
      LIMIT v_lim
    ) report_hits
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_workspace (text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_workspace_notifications ()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_overdue_enabled boolean := true;
  v_due_soon_days integer := 3;
  v_lease_expiring_enabled boolean := true;
  v_tz text := 'Africa/Johannesburg';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT
    coalesce(us.overdue_alerts_enabled, true),
    coalesce(us.payment_reminder_days_before_due, 3),
    coalesce(us.lease_expiring_alerts_enabled, true)
  INTO v_overdue_enabled, v_due_soon_days, v_lease_expiring_enabled
  FROM public.user_settings us
  WHERE us.user_id = v_uid;

  RETURN coalesce((
    SELECT jsonb_agg(n ORDER BY (n ->> 'severity') DESC, n ->> 'occurredAt')
    FROM (
      SELECT jsonb_build_object(
        'id', 'rent-overdue-' || pk.tenant_id::text || '-' || pk.period_key,
        'kind', 'rent_overdue',
        'severity', 'danger',
        'title', 'Rent overdue',
        'subtitle', nullif(trim(concat_ws(' · ', pk.tenant_name, pk.property_name, 'Due ' || to_char(pk.min_due AT TIME ZONE v_tz, 'DD Mon YYYY'))), ''),
        'route', CASE
          WHEN pk.invoice_id IS NOT NULL THEN '/invoices/' || pk.invoice_id::text
          ELSE '/tenants/' || pk.tenant_id::text
        END,
        'occurredAt', pk.min_due
      ) AS n
      FROM (
        SELECT
          inv.tenant_id,
          tn.first_name || ' ' || tn.last_name AS tenant_name,
          pr.name AS property_name,
          concat_ws(
            '-',
            inv.tenant_id::text,
            (extract(YEAR FROM timezone(v_tz, inv.due_date)))::int::text,
            (extract(MONTH FROM timezone(v_tz, inv.due_date)))::int::text
          ) AS period_key,
          min(inv.due_date) AS min_due,
          (
            SELECT i2.id
            FROM public.invoices i2
            WHERE
              i2.user_id = v_uid
              AND i2.tenant_id = inv.tenant_id
              AND i2.status NOT IN ('PAID', 'CANCELLED')
              AND extract(YEAR FROM timezone(v_tz, i2.due_date)) = extract(YEAR FROM timezone(v_tz, inv.due_date))
              AND extract(MONTH FROM timezone(v_tz, i2.due_date)) = extract(MONTH FROM timezone(v_tz, inv.due_date))
            ORDER BY i2.due_date ASC, i2.created_at DESC
            LIMIT 1
          ) AS invoice_id
        FROM public.invoices inv
        JOIN public.tenants tn ON tn.id = inv.tenant_id
        JOIN public.properties pr ON pr.id = inv.property_id
        WHERE
          inv.user_id = v_uid
          AND inv.status NOT IN ('PAID', 'CANCELLED')
        GROUP BY inv.tenant_id, tn.first_name, tn.last_name, pr.name, period_key
        HAVING min(inv.due_date) < now()
      ) pk
      WHERE v_overdue_enabled

      UNION ALL

      SELECT jsonb_build_object(
        'id', 'rent-due-soon-' || pk.tenant_id::text || '-' || pk.period_key,
        'kind', 'rent_due_soon',
        'severity', 'warning',
        'title', 'Rent due soon',
        'subtitle', nullif(trim(concat_ws(' · ', pk.tenant_name, pk.property_name, 'Due ' || to_char(pk.min_due AT TIME ZONE v_tz, 'DD Mon YYYY'))), ''),
        'route', CASE
          WHEN pk.invoice_id IS NOT NULL THEN '/invoices/' || pk.invoice_id::text
          ELSE '/tenants/' || pk.tenant_id::text
        END,
        'occurredAt', pk.min_due
      )
      FROM (
        SELECT
          inv.tenant_id,
          tn.first_name || ' ' || tn.last_name AS tenant_name,
          pr.name AS property_name,
          concat_ws(
            '-',
            inv.tenant_id::text,
            (extract(YEAR FROM timezone(v_tz, inv.due_date)))::int::text,
            (extract(MONTH FROM timezone(v_tz, inv.due_date)))::int::text
          ) AS period_key,
          min(inv.due_date) AS min_due,
          (
            SELECT i2.id
            FROM public.invoices i2
            WHERE
              i2.user_id = v_uid
              AND i2.tenant_id = inv.tenant_id
              AND i2.status NOT IN ('PAID', 'CANCELLED')
              AND extract(YEAR FROM timezone(v_tz, i2.due_date)) = extract(YEAR FROM timezone(v_tz, inv.due_date))
              AND extract(MONTH FROM timezone(v_tz, i2.due_date)) = extract(MONTH FROM timezone(v_tz, inv.due_date))
            ORDER BY i2.due_date ASC, i2.created_at DESC
            LIMIT 1
          ) AS invoice_id
        FROM public.invoices inv
        JOIN public.tenants tn ON tn.id = inv.tenant_id
        JOIN public.properties pr ON pr.id = inv.property_id
        WHERE
          inv.user_id = v_uid
          AND inv.status NOT IN ('PAID', 'CANCELLED')
        GROUP BY inv.tenant_id, tn.first_name, tn.last_name, pr.name, period_key
        HAVING
          min(inv.due_date) >= now()
          AND min(inv.due_date) <= now() + make_interval(days => greatest(v_due_soon_days, 1))
      ) pk
      WHERE v_due_soon_days > 0

      UNION ALL

      SELECT jsonb_build_object(
        'id', 'lease-expiring-' || l.id::text,
        'kind', 'lease_expiring',
        'severity', 'warning',
        'title', 'Lease expiring soon',
        'subtitle', nullif(trim(concat_ws(' · ', trim(concat_ws(' ', tn.first_name, tn.last_name)), pr.name, 'Ends ' || to_char(l.fixed_term_end_date AT TIME ZONE v_tz, 'DD Mon YYYY'))), ''),
        'route', '/owned-properties/' || l.property_id::text || '?tab=leases',
        'occurredAt', l.fixed_term_end_date
      )
      FROM public.leases l
      JOIN public.tenants tn ON tn.id = l.tenant_id
      JOIN public.properties pr ON pr.id = l.property_id
      WHERE
        l.user_id = v_uid
        AND l.status = 'ACTIVE'
        AND l.fixed_term_end_date IS NOT NULL
        AND l.fixed_term_end_date >= now()
        AND l.fixed_term_end_date <= now() + interval '60 days'
        AND v_lease_expiring_enabled
    ) alerts
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_notifications () TO authenticated;

-- upsert_user_settings: lease expiring dashboard alerts
CREATE OR REPLACE FUNCTION public.upsert_user_settings (p_payload jsonb)
  RETURNS public.user_settings
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_settings %ROWTYPE;
  v_theme text;
  v_days integer;
  v_rent_day integer;
  v_term integer;
  v_reminder integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM public.get_or_create_user_settings();

  IF p_payload ? 'themePreference' OR p_payload ? 'theme_preference' THEN
    v_theme := coalesce(p_payload ->> 'themePreference', p_payload ->> 'theme_preference');
    IF v_theme NOT IN ('light', 'dark', 'system') THEN
      RAISE EXCEPTION 'INVALID_THEME_PREFERENCE';
    END IF;
    UPDATE public.user_settings SET theme_preference = v_theme WHERE user_id = v_uid;
    IF v_theme IN ('light', 'dark') THEN
      UPDATE public.profiles SET ui_color_scheme = v_theme, updated_at = now() WHERE id = v_uid;
    END IF;
  END IF;

  IF p_payload ? 'accentColor' OR p_payload ? 'accent_color' THEN
    UPDATE public.user_settings
    SET accent_color = coalesce(p_payload ->> 'accentColor', p_payload ->> 'accent_color')
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'density' THEN
    IF (p_payload ->> 'density') NOT IN ('comfortable', 'compact') THEN
      RAISE EXCEPTION 'INVALID_DENSITY';
    END IF;
    UPDATE public.user_settings SET density = p_payload ->> 'density' WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'defaultCurrency' OR p_payload ? 'default_currency' THEN
    UPDATE public.user_settings
    SET default_currency = coalesce(p_payload ->> 'defaultCurrency', p_payload ->> 'default_currency')
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'statementDefaultFilter' OR p_payload ? 'statement_default_filter' THEN
    UPDATE public.user_settings
    SET statement_default_filter = coalesce(
      p_payload ->> 'statementDefaultFilter',
      p_payload ->> 'statement_default_filter'
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'leaseDefaultTermMonths' OR p_payload ? 'lease_default_term_months' THEN
    v_term := coalesce(
      (p_payload ->> 'leaseDefaultTermMonths')::integer,
      (p_payload ->> 'lease_default_term_months')::integer
    );
    IF v_term IS NULL OR v_term <= 0 THEN
      RAISE EXCEPTION 'INVALID_LEASE_DEFAULT_TERM';
    END IF;
    UPDATE public.user_settings SET lease_default_term_months = v_term WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'defaultRentDueDay' OR p_payload ? 'default_rent_due_day' THEN
    v_rent_day := coalesce(
      (p_payload ->> 'defaultRentDueDay')::integer,
      (p_payload ->> 'default_rent_due_day')::integer
    );
    IF v_rent_day IS NULL OR v_rent_day < 1 OR v_rent_day > 28 THEN
      RAISE EXCEPTION 'INVALID_DEFAULT_RENT_DUE_DAY';
    END IF;
    UPDATE public.user_settings SET default_rent_due_day = v_rent_day WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'recurringExpenseDefaultCategory' OR p_payload ? 'recurring_expense_default_category' THEN
    UPDATE public.user_settings
    SET recurring_expense_default_category = coalesce(
      p_payload ->> 'recurringExpenseDefaultCategory',
      p_payload ->> 'recurring_expense_default_category'
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'autoGenerateInvoices' OR p_payload ? 'auto_generate_invoices' THEN
    UPDATE public.user_settings
    SET auto_generate_invoices = coalesce(
      (p_payload ->> 'autoGenerateInvoices')::boolean,
      (p_payload ->> 'auto_generate_invoices')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'invoiceGenerateDaysBeforeDue' OR p_payload ? 'invoice_generate_days_before_due' THEN
    v_days := coalesce(
      (p_payload ->> 'invoiceGenerateDaysBeforeDue')::integer,
      (p_payload ->> 'invoice_generate_days_before_due')::integer
    );
    IF v_days IS NULL OR v_days < 0 OR v_days > 31 THEN
      RAISE EXCEPTION 'INVALID_INVOICE_GENERATE_DAYS';
    END IF;
    UPDATE public.user_settings
    SET invoice_generate_days_before_due = v_days
    WHERE user_id = v_uid;
    UPDATE public.profiles
    SET rent_invoice_days_before_due = v_days, updated_at = now()
    WHERE id = v_uid;
  END IF;

  IF p_payload ? 'invoiceNumberFormat' OR p_payload ? 'invoice_number_format' THEN
    UPDATE public.user_settings
    SET invoice_number_format = coalesce(
      p_payload ->> 'invoiceNumberFormat',
      p_payload ->> 'invoice_number_format'
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'pdfBrandingEnabled' OR p_payload ? 'pdf_branding_enabled' THEN
    UPDATE public.user_settings
    SET pdf_branding_enabled = coalesce(
      (p_payload ->> 'pdfBrandingEnabled')::boolean,
      (p_payload ->> 'pdf_branding_enabled')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'paymentReminderDaysBeforeDue' OR p_payload ? 'payment_reminder_days_before_due' THEN
    v_reminder := coalesce(
      (p_payload ->> 'paymentReminderDaysBeforeDue')::integer,
      (p_payload ->> 'payment_reminder_days_before_due')::integer
    );
    IF v_reminder IS NULL OR v_reminder < 0 OR v_reminder > 31 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_REMINDER_DAYS';
    END IF;
    UPDATE public.user_settings
    SET payment_reminder_days_before_due = v_reminder
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'overdueAlertsEnabled' OR p_payload ? 'overdue_alerts_enabled' THEN
    UPDATE public.user_settings
    SET overdue_alerts_enabled = coalesce(
      (p_payload ->> 'overdueAlertsEnabled')::boolean,
      (p_payload ->> 'overdue_alerts_enabled')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'monthlySummariesEnabled' OR p_payload ? 'monthly_summaries_enabled' THEN
    UPDATE public.user_settings
    SET monthly_summaries_enabled = coalesce(
      (p_payload ->> 'monthlySummariesEnabled')::boolean,
      (p_payload ->> 'monthly_summaries_enabled')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'newLeaseAlertsEnabled' OR p_payload ? 'new_lease_alerts_enabled' THEN
    UPDATE public.user_settings
    SET new_lease_alerts_enabled = coalesce(
      (p_payload ->> 'newLeaseAlertsEnabled')::boolean,
      (p_payload ->> 'new_lease_alerts_enabled')::boolean
    )
    WHERE user_id = v_uid;
  END IF;


  IF p_payload ? 'leaseExpiringAlertsEnabled' OR p_payload ? 'lease_expiring_alerts_enabled' THEN
    UPDATE public.user_settings
    SET lease_expiring_alerts_enabled = coalesce(
      (p_payload ->> 'leaseExpiringAlertsEnabled')::boolean,
      (p_payload ->> 'lease_expiring_alerts_enabled')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'lockInvoiceAfterSent' OR p_payload ? 'lock_invoice_after_sent' THEN
    UPDATE public.user_settings
    SET lock_invoice_after_sent = coalesce(
      (p_payload ->> 'lockInvoiceAfterSent')::boolean,
      (p_payload ->> 'lock_invoice_after_sent')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'applicantFormTemplate' OR p_payload ? 'applicant_form_template' THEN
    UPDATE public.user_settings
    SET applicant_form_template = public.normalize_applicant_form_template(
      coalesce(p_payload -> 'applicantFormTemplate', p_payload -> 'applicant_form_template')
    )
    WHERE user_id = v_uid;
  END IF;

  SELECT * INTO v_row FROM public.user_settings WHERE user_id = v_uid;
  RETURN v_row;
END;
$$;
