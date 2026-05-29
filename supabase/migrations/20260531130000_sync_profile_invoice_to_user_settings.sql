-- Keep profile invoice automation RPC in sync with user_settings (single source of truth).

CREATE OR REPLACE FUNCTION public.update_profile_invoice_automation_settings (p_payload jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer;
  v_grace integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM public.get_or_create_user_settings();

  IF p_payload ? 'rentInvoiceDaysBeforeDue' OR p_payload ? 'rent_invoice_days_before_due' THEN
    v_days := coalesce(
      (p_payload ->> 'rentInvoiceDaysBeforeDue')::integer,
      (p_payload ->> 'rent_invoice_days_before_due')::integer
    );
    IF v_days < 0 OR v_days > 31 THEN
      RAISE EXCEPTION 'INVALID_DAYS_BEFORE_DUE';
    END IF;
    UPDATE public.profiles
    SET rent_invoice_days_before_due = v_days, updated_at = now()
    WHERE id = v_uid;
    UPDATE public.user_settings
    SET invoice_generate_days_before_due = v_days, updated_at = now()
    WHERE user_id = v_uid;
  END IF;

  IF p_payload ? 'rentInvoiceGracePeriodDays' OR p_payload ? 'rent_invoice_grace_period_days' THEN
    v_grace := coalesce(
      (p_payload ->> 'rentInvoiceGracePeriodDays')::integer,
      (p_payload ->> 'rent_invoice_grace_period_days')::integer
    );
    IF v_grace < 0 OR v_grace > 31 THEN
      RAISE EXCEPTION 'INVALID_GRACE_PERIOD';
    END IF;
    UPDATE public.profiles
    SET rent_invoice_grace_period_days = v_grace, updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'rentInvoiceDaysBeforeDue', coalesce(s.days_before_due, 10),
      'rentInvoiceGracePeriodDays', coalesce(s.grace_period_days, 7),
      'autoGenerateInvoices', coalesce(s.auto_generate, true)
    )
    FROM public.resolve_rent_invoice_settings(v_uid) s
  );
END;
$$;
