-- Global applicant form template per user (user_settings.applicant_form_template)

CREATE OR REPLACE FUNCTION public.default_applicant_form_template ()
  RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT jsonb_build_object(
    'title', 'Rental application',
    'description', 'Please complete all required fields. Your information is shared only with the property owner.',
    'allowCoApplicant', true,
    'fields', jsonb_build_array(
      jsonb_build_object('id', 'firstName', 'label', 'First name', 'type', 'text', 'required', true, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'lastName', 'label', 'Surname', 'type', 'text', 'required', true, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'idNumber', 'label', 'ID number', 'type', 'text', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'phone', 'label', 'Contact number', 'type', 'phone', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'email', 'label', 'Email address', 'type', 'email', 'required', true, 'width', 'full', 'system', true),
      jsonb_build_object('id', 'monthlyIncome', 'label', 'Monthly income (after tax)', 'type', 'income', 'required', true, 'width', 'full', 'system', true),
      jsonb_build_object('id', 'previousResidency', 'label', 'Previous residency', 'type', 'text', 'required', false, 'width', 'full', 'system', true),
      jsonb_build_object('id', 'landlordContact', 'label', 'Landlord contact details', 'type', 'text', 'required', false, 'width', 'half', 'system', true),
      jsonb_build_object('id', 'timeRented', 'label', 'Time rented', 'type', 'text', 'required', false, 'width', 'half', 'placeholder', 'e.g. 2 years', 'system', true)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_applicant_form_template (p_template jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  v_fields jsonb := coalesce(p_template -> 'fields', '[]'::jsonb);
  v_out jsonb := '[]'::jsonb;
  v_field jsonb;
  v_id text;
  v_type text;
  v_seen text[] := ARRAY[]::text[];
  v_required_system text[] := ARRAY['firstName', 'lastName', 'email', 'monthlyIncome'];
  v_sys text;
BEGIN
  IF jsonb_typeof(v_fields) <> 'array' THEN
    RETURN public.default_applicant_form_template();
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(v_fields) LOOP
    v_id := trim(coalesce(v_field ->> 'id', ''));
    IF v_id = '' OR v_id = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_type := coalesce(v_field ->> 'type', 'text');
    IF v_type NOT IN ('text', 'email', 'phone', 'income') THEN
      v_type := 'text';
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'label', coalesce(nullif(trim(v_field ->> 'label'), ''), v_id),
      'type', v_type,
      'required', coalesce((v_field ->> 'required')::boolean, false),
      'width', CASE WHEN coalesce(v_field ->> 'width', 'full') = 'half' THEN 'half' ELSE 'full' END,
      'placeholder', nullif(trim(coalesce(v_field ->> 'placeholder', '')), ''),
      'system', coalesce((v_field ->> 'system')::boolean, false)
    ));
    v_seen := array_append(v_seen, v_id);
  END LOOP;

  FOREACH v_sys IN ARRAY v_required_system LOOP
    IF NOT (v_sys = ANY (v_seen)) THEN
      RETURN public.default_applicant_form_template();
    END IF;
  END LOOP;

  IF jsonb_array_length(v_out) = 0 THEN
    RETURN public.default_applicant_form_template();
  END IF;

  RETURN jsonb_build_object(
    'title', coalesce(nullif(trim(p_template ->> 'title'), ''), 'Rental application'),
    'description', coalesce(p_template ->> 'description', ''),
    'allowCoApplicant', coalesce((p_template ->> 'allowCoApplicant')::boolean, true),
    'fields', v_out
  );
END;
$$;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS applicant_form_template jsonb NOT NULL DEFAULT public.default_applicant_form_template();

UPDATE public.user_settings
SET applicant_form_template = public.default_applicant_form_template()
WHERE applicant_form_template IS NULL;

COMMENT ON COLUMN public.user_settings.applicant_form_template IS
  'Global applicant share-link form definition (fields, labels, co-applicant toggle).';

-- upsert_user_settings: applicant form template patch
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

-- Include template on public invite context
CREATE OR REPLACE FUNCTION public.get_applicant_invite_public (p_token text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_inv public.applicant_invites %ROWTYPE;
  v_property public.properties %ROWTYPE;
  v_unit public.property_units %ROWTYPE;
  v_rent double precision;
  v_template jsonb;
BEGIN
  SELECT
    * INTO v_inv
  FROM
    public.applicant_invites i
  WHERE
    i.token = p_token
    AND i.revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  SELECT
    * INTO v_property
  FROM
    public.properties p
  WHERE
    p.id = v_inv.property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  IF v_inv.unit_id IS NOT NULL THEN
    SELECT
      * INTO v_unit
    FROM
      public.property_units u
    WHERE
      u.id = v_inv.unit_id;
  END IF;

  v_rent := public.resolve_property_target_rent(v_inv.property_id);

  SELECT
    coalesce(us.applicant_form_template, public.default_applicant_form_template()) INTO v_template
  FROM
    public.user_settings us
  WHERE
    us.user_id = v_inv.user_id;

  IF v_template IS NULL THEN
    v_template := public.default_applicant_form_template();
  END IF;

  RETURN jsonb_build_object(
    'propertyName', v_property.name,
    'propertyAddress', trim(both ', ' FROM concat_ws(', ', v_property.address_line1, v_property.suburb, v_property.city)),
    'unitName', v_unit.unit_name,
    'targetRent', v_rent,
    'formTemplate', v_template
  );
END;
$$;
