-- User-level settings (appearance, defaults, invoice automation, notifications)
-- Reuses existing invoice generation path; no duplicate generator.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  theme_preference text NOT NULL DEFAULT 'system',
  accent_color text NOT NULL DEFAULT 'purple',
  density text NOT NULL DEFAULT 'comfortable',
  default_currency text NOT NULL DEFAULT 'ZAR',
  statement_default_filter text NOT NULL DEFAULT '6_months',
  lease_default_term_months integer NOT NULL DEFAULT 12,
  default_rent_due_day integer NOT NULL DEFAULT 1,
  recurring_expense_default_category text NOT NULL DEFAULT 'maintenance',
  auto_generate_invoices boolean NOT NULL DEFAULT true,
  invoice_generate_days_before_due integer NOT NULL DEFAULT 10,
  invoice_number_format text NOT NULL DEFAULT 'INV-YYYY-{####}',
  pdf_branding_enabled boolean NOT NULL DEFAULT true,
  payment_reminder_days_before_due integer NOT NULL DEFAULT 3,
  overdue_alerts_enabled boolean NOT NULL DEFAULT true,
  monthly_summaries_enabled boolean NOT NULL DEFAULT true,
  new_lease_alerts_enabled boolean NOT NULL DEFAULT false,
  lock_invoice_after_sent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_theme_preference_check CHECK (theme_preference IN ('light', 'dark', 'system')),
  CONSTRAINT user_settings_density_check CHECK (density IN ('comfortable', 'compact')),
  CONSTRAINT user_settings_lease_default_term_months_check CHECK (lease_default_term_months > 0),
  CONSTRAINT user_settings_default_rent_due_day_check CHECK (default_rent_due_day BETWEEN 1 AND 28),
  CONSTRAINT user_settings_invoice_generate_days_before_due_check CHECK (invoice_generate_days_before_due BETWEEN 0 AND 31),
  CONSTRAINT user_settings_payment_reminder_days_before_due_check CHECK (payment_reminder_days_before_due BETWEEN 0 AND 31)
);

CREATE INDEX IF NOT EXISTS user_settings_updated_at_idx ON public.user_settings (updated_at DESC);

COMMENT ON TABLE public.user_settings IS
  'Per-user workspace preferences: theme, property defaults, invoice automation, notifications.';

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- get_or_create_user_settings: idempotent row with profile migration
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_user_settings ()
  RETURNS public.user_settings
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_settings %ROWTYPE;
  v_profile public.profiles %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_row FROM public.user_settings WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.user_settings (
    user_id,
    theme_preference,
    invoice_generate_days_before_due,
    auto_generate_invoices
  )
  VALUES (
    v_uid,
    CASE
      WHEN v_profile.ui_color_scheme = 'light' THEN 'light'
      WHEN v_profile.ui_color_scheme = 'dark' THEN 'dark'
      ELSE 'system'
    END,
    coalesce(v_profile.rent_invoice_days_before_due, 10),
    true
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.user_settings WHERE user_id = v_uid;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_user_settings () TO authenticated;

-- ---------------------------------------------------------------------------
-- upsert_user_settings: validated patch from SPA
-- ---------------------------------------------------------------------------

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

  IF p_payload ? 'lockInvoiceAfterSent' OR p_payload ? 'lock_invoice_after_sent' THEN
    UPDATE public.user_settings
    SET lock_invoice_after_sent = coalesce(
      (p_payload ->> 'lockInvoiceAfterSent')::boolean,
      (p_payload ->> 'lock_invoice_after_sent')::boolean
    )
    WHERE user_id = v_uid;
  END IF;

  SELECT * INTO v_row FROM public.user_settings WHERE user_id = v_uid;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_settings (jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Invoice automation: read user_settings in resolve_rent_invoice_settings
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.resolve_rent_invoice_settings (uuid);

CREATE OR REPLACE FUNCTION public.resolve_rent_invoice_settings (p_user_id uuid)
  RETURNS TABLE (days_before_due integer, grace_period_days integer, auto_generate boolean)
  LANGUAGE sql
  STABLE
  AS $$
  SELECT
    coalesce(
      us.invoice_generate_days_before_due,
      p.rent_invoice_days_before_due,
      d.rent_invoice_days_before_due,
      10
    )::integer,
    coalesce(
      p.rent_invoice_grace_period_days,
      d.rent_invoice_grace_period_days,
      7
    )::integer,
    coalesce(us.auto_generate_invoices, true)::boolean
  FROM public.profiles p
  LEFT JOIN public.user_settings us ON us.user_id = p.id
  CROSS JOIN (
    SELECT
      rent_invoice_days_before_due,
      rent_invoice_grace_period_days
    FROM public.portfolio_projection_defaults
    ORDER BY created_at ASC
    LIMIT 1
  ) d
  WHERE p.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- generate_due_lease_invoices: respect auto_generate_invoices per user
-- (Minimal patch — preserves existing loop, idempotency, and column set.)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_due_lease_invoices (p_as_of date DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_uid uuid := auth.uid();
  v_today date;
  v_lease public.leases %ROWTYPE;
  v_days_before integer;
  v_grace integer;
  v_auto_generate boolean;
  v_checked integer := 0;
  v_created integer := 0;
  v_skipped_dup integer := 0;
  v_skipped_inactive integer := 0;
  v_skipped_not_due integer := 0;
  v_skipped_auto_off integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_offset integer;
  v_anchor date;
  v_year integer;
  v_month integer;
  v_due_date date;
  v_gen_date date;
  v_period text;
  v_inv_id uuid;
  v_num text;
  v_desc text;
  v_due_ts timestamptz;
  v_issue_ts timestamptz;
  v_rent double precision;
  v_err text;
  v_last_user_id uuid := NULL;
  v_last_auto boolean := true;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' AND v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  v_today := coalesce(p_as_of, public.app_business_date());

  FOR v_lease IN
    SELECT l.*
    FROM public.leases l
    WHERE v_role = 'service_role'
      OR l.user_id = v_uid
    ORDER BY l.user_id, l.id
  LOOP
    v_checked := v_checked + 1;

    BEGIN
      IF v_lease.user_id IS DISTINCT FROM v_last_user_id THEN
        SELECT s.days_before_due, s.grace_period_days, s.auto_generate
        INTO v_days_before, v_grace, v_auto_generate
        FROM public.resolve_rent_invoice_settings(v_lease.user_id) s;
        v_last_user_id := v_lease.user_id;
        v_last_auto := coalesce(v_auto_generate, true);
      END IF;

      IF NOT v_last_auto THEN
        v_skipped_auto_off := v_skipped_auto_off + 1;
        CONTINUE;
      END IF;

      IF NOT public.lease_is_invoice_eligible(v_lease, v_today) THEN
        v_skipped_inactive := v_skipped_inactive + 1;
        CONTINUE;
      END IF;

      v_rent := v_lease.monthly_rent;
      IF v_rent IS NULL OR v_rent < 0 THEN
        RAISE EXCEPTION 'INVALID_LEASE_RENT';
      END IF;

      FOR v_offset IN -1..1 LOOP
        v_anchor := (date_trunc('month', v_today::timestamp)::date + (v_offset || ' months')::interval)::date;
        v_year := EXTRACT(YEAR FROM v_anchor)::integer;
        v_month := EXTRACT(MONTH FROM v_anchor)::integer;
        v_due_date := public.lease_rent_due_date(v_year, v_month, v_lease.rent_due_day);
        v_gen_date := v_due_date - v_days_before;
        v_period := to_char(v_due_date, 'YYYY-MM');

        IF v_today < v_gen_date THEN
          v_skipped_not_due := v_skipped_not_due + 1;
          CONTINUE;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM public.invoices i
          WHERE i.lease_id = v_lease.id
            AND i.invoice_type = 'RENT'::public.app_invoice_type
            AND i.invoice_period = v_period
            AND i.status NOT IN (
              'CANCELLED'::public.app_invoice_status,
              'VOID'::public.app_invoice_status
            )
        ) THEN
          v_skipped_dup := v_skipped_dup + 1;
          CONTINUE;
        END IF;

        v_num := public.generate_invoice_number();
        v_desc := 'Monthly Rent — ' || v_period;
        v_due_ts := (v_due_date::text || 'T12:00:00+00')::timestamptz;
        v_issue_ts := (v_today::text || 'T12:00:00+00')::timestamptz;

        INSERT INTO public.invoices (
          user_id,
          property_id,
          tenant_id,
          lease_id,
          unit_id,
          invoice_number,
          invoice_type,
          invoice_period,
          invoice_date,
          issue_date,
          due_date,
          status,
          subtotal,
          tax_amount,
          total,
          total_amount,
          balance_due,
          notes
        )
        VALUES (
          v_lease.user_id,
          v_lease.property_id,
          v_lease.tenant_id,
          v_lease.id,
          v_lease.unit_id,
          v_num,
          'RENT'::public.app_invoice_type,
          v_period,
          v_issue_ts,
          v_issue_ts,
          v_due_ts,
          'GENERATED'::public.app_invoice_status,
          v_rent,
          0,
          v_rent,
          v_rent,
          v_rent,
          NULL
        )
        RETURNING id INTO v_inv_id;

        INSERT INTO public.invoice_line_items (
          invoice_id,
          description,
          category,
          quantity,
          unit_price,
          total,
          sort_order
        )
        VALUES (
          v_inv_id,
          v_desc,
          'RENT'::public.app_property_income_category,
          1,
          v_rent,
          v_rent,
          1
        );

        v_created := v_created + 1;
      END LOOP;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped_dup := v_skipped_dup + 1;
      WHEN OTHERS THEN
        v_err := SQLERRM;
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'lease_id', v_lease.id::text,
            'property_id', v_lease.property_id::text,
            'message', v_err
          )
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'leases_checked', v_checked,
    'invoices_created', v_created,
    'skipped_duplicate', v_skipped_dup,
    'skipped_inactive', v_skipped_inactive,
    'skipped_not_due', v_skipped_not_due,
    'skipped_auto_disabled', v_skipped_auto_off,
    'errors', v_errors,
    'as_of_date', v_today::text,
    'timezone', public.app_business_timezone()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_due_lease_invoices (date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_lease_invoices (date) TO service_role;
