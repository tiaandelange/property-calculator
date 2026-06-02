-- Future projections defaults stored per user (used across dashboard + PDFs + projections)

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS annual_income_growth_percent_annual double precision NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS expense_growth_percent_annual double precision NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS property_appreciation_percent_annual double precision NOT NULL DEFAULT 6;

COMMENT ON COLUMN public.user_settings.annual_income_growth_percent_annual IS
  'Annual income growth percentage used for future projections (dashboard + PDFs).';
COMMENT ON COLUMN public.user_settings.expense_growth_percent_annual IS
  'Annual expense growth / inflation percentage used for future projections (dashboard + PDFs).';
COMMENT ON COLUMN public.user_settings.property_appreciation_percent_annual IS
  'Annual property appreciation percentage used for future projections (dashboard + PDFs).';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_annual_income_growth_check,
  DROP CONSTRAINT IF EXISTS user_settings_expense_growth_check,
  DROP CONSTRAINT IF EXISTS user_settings_property_appreciation_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_annual_income_growth_check CHECK (annual_income_growth_percent_annual BETWEEN 0 AND 30),
  ADD CONSTRAINT user_settings_expense_growth_check CHECK (expense_growth_percent_annual BETWEEN 0 AND 30),
  ADD CONSTRAINT user_settings_property_appreciation_check CHECK (property_appreciation_percent_annual BETWEEN 0 AND 30);

-- Extend upsert_user_settings RPC to accept these fields.
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
  v_income_growth double precision;
  v_expense_growth double precision;
  v_appreciation double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM public.get_or_create_user_settings();

  -- Existing fields (kept in sync with prior migrations)
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

  -- New: future projection defaults
  IF p_payload ? 'annualIncomeGrowthPercentAnnual' OR p_payload ? 'annual_income_growth_percent_annual' THEN
    v_income_growth := coalesce(
      nullif(p_payload ->> 'annualIncomeGrowthPercentAnnual', '')::double precision,
      nullif(p_payload ->> 'annual_income_growth_percent_annual', '')::double precision
    );
    IF v_income_growth IS NULL OR v_income_growth < 0 OR v_income_growth > 30 THEN
      RAISE EXCEPTION 'INVALID_ANNUAL_INCOME_GROWTH';
    END IF;
    UPDATE public.user_settings SET annual_income_growth_percent_annual = v_income_growth WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'expenseGrowthPercentAnnual' OR p_payload ? 'expense_growth_percent_annual' THEN
    v_expense_growth := coalesce(
      nullif(p_payload ->> 'expenseGrowthPercentAnnual', '')::double precision,
      nullif(p_payload ->> 'expense_growth_percent_annual', '')::double precision
    );
    IF v_expense_growth IS NULL OR v_expense_growth < 0 OR v_expense_growth > 30 THEN
      RAISE EXCEPTION 'INVALID_EXPENSE_GROWTH';
    END IF;
    UPDATE public.user_settings SET expense_growth_percent_annual = v_expense_growth WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'propertyAppreciationPercentAnnual' OR p_payload ? 'property_appreciation_percent_annual' THEN
    v_appreciation := coalesce(
      nullif(p_payload ->> 'propertyAppreciationPercentAnnual', '')::double precision,
      nullif(p_payload ->> 'property_appreciation_percent_annual', '')::double precision
    );
    IF v_appreciation IS NULL OR v_appreciation < 0 OR v_appreciation > 30 THEN
      RAISE EXCEPTION 'INVALID_PROPERTY_APPRECIATION';
    END IF;
    UPDATE public.user_settings SET property_appreciation_percent_annual = v_appreciation WHERE user_id = v_uid;
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

  IF p_payload ? 'useBusinessForFinancials' OR p_payload ? 'use_business_for_financials' THEN
    UPDATE public.user_settings
    SET use_business_for_financials = coalesce(
      (p_payload ->> 'useBusinessForFinancials')::boolean,
      (p_payload ->> 'use_business_for_financials')::boolean,
      false
    )
    WHERE user_id = v_uid;
  END IF;

  SELECT * INTO v_row FROM public.user_settings WHERE user_id = v_uid;
  RETURN v_row;
END;
$$;

