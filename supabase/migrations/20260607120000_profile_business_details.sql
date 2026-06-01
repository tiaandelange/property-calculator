-- Personal profile + business details for invoices/financials; avatar storage.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.profile_details IS
  'Personal contact JSON: phone, address, avatarStorageKey (avatars bucket path).';

COMMENT ON COLUMN public.profiles.business_details IS
  'Business/landlord JSON for financial documents: businessName, landlordName, email, phone, address.';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS use_business_for_financials boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.use_business_for_financials IS
  'When true, invoices and financial PDFs use business_details instead of personal profile.';

-- ---------------------------------------------------------------------------
-- update_profile_details — personal + business JSON + display name
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_profile_details (
  p_full_name text DEFAULT NULL,
  p_profile_details jsonb DEFAULT NULL,
  p_business_details jsonb DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_profile_details IS NOT NULL AND jsonb_typeof(p_profile_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_profile_details must be a JSON object';
  END IF;

  IF p_business_details IS NOT NULL AND jsonb_typeof(p_business_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_business_details must be a JSON object';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET
    full_name = CASE WHEN p_full_name IS NOT NULL THEN nullif(trim(p_full_name), '') ELSE full_name END,
    profile_details = coalesce(p_profile_details, profile_details),
    business_details = coalesce(p_business_details, business_details),
    updated_at = now()
  WHERE
    id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object(
    'fullName',
    (SELECT full_name FROM public.profiles WHERE id = v_uid),
    'profileDetails',
    (SELECT profile_details FROM public.profiles WHERE id = v_uid),
    'businessDetails',
    (SELECT business_details FROM public.profiles WHERE id = v_uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_details (text, jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_profile_details (text, jsonb, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- upsert_user_settings — use_business_for_financials
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

-- ---------------------------------------------------------------------------
-- Avatars storage bucket (private; path: {user_id}/avatar.*)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS avatars_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS avatars_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_storage_delete_own ON storage.objects;

CREATE POLICY avatars_storage_select_own ON storage.objects FOR
SELECT TO authenticated USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY avatars_storage_insert_own ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY avatars_storage_update_own ON storage.objects FOR
UPDATE TO authenticated USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY avatars_storage_delete_own ON storage.objects FOR
DELETE TO authenticated USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);
