-- Server-side subscription limits: properties, monthly reports, applicant links.
-- Admin role + bootstrap owner email bypass all limits. No payment logic.

-- ---------------------------------------------------------------------------
-- Shared bypass (profiles.role ADMIN or bootstrap admin email)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.subscription_limits_bypass (p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_user_role;
  v_subscription public.app_subscription_status;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.role, p.subscription_status, p.email
  INTO v_role, v_subscription, v_email
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_role = 'ADMIN'::public.app_user_role THEN
    RETURN true;
  END IF;

  IF v_subscription = 'SUBSCRIBED'::public.app_subscription_status THEN
    RETURN true;
  END IF;

  SELECT u.email
  INTO v_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  RETURN public.is_bootstrap_admin_email(v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_limits_bypass (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_limits_bypass (uuid) TO authenticated;

COMMENT ON FUNCTION public.subscription_limits_bypass (uuid) IS
  'True when the user is ADMIN or the bootstrap owner email (unlimited plan limits).';

-- ---------------------------------------------------------------------------
-- 1) Property creation limit (BEFORE INSERT on properties)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_can_create_property (p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_count integer;
  v_limit integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF public.subscription_limits_bypass(p_user_id) THEN
    RETURN;
  END IF;

  SELECT us.plan_code, us.status
  INTO v_sub
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  IF NOT FOUND OR v_sub.status NOT IN ('active', 'trialing', 'pending_payment') THEN
    RETURN;
  END IF;

  SELECT sp.max_properties
  INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.code = v_sub.plan_code
    AND sp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan not found or inactive.';
  END IF;

  IF v_plan.max_properties IS NULL THEN
    RETURN;
  END IF;

  v_limit := v_plan.max_properties;

  SELECT count(*)::integer
  INTO v_count
  FROM public.properties p
  WHERE p.user_id = p_user_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your current plan allows up to % properties. Upgrade to add more.', v_limit;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_create_property (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_create_property (uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_properties_assert_plan_limit ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_create_property(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_assert_plan_limit ON public.properties;

CREATE TRIGGER properties_assert_plan_limit
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.trg_properties_assert_plan_limit();

COMMENT ON FUNCTION public.assert_can_create_property (uuid) IS
  'Raises when the user is at max_properties for their active plan. No-op without an entitled subscription.';

-- ---------------------------------------------------------------------------
-- 2) Monthly report quota (investment + calculation PDFs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_user_reports_in_period (
  p_user_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT greatest(
      coalesce((
        SELECT count(*)::integer
        FROM public.stored_reports sr
        WHERE sr.user_id = p_user_id
          AND sr.report_type IN ('CALCULATION', 'INVESTMENT_REPORT', 'PROPERTY_SUMMARY')
          AND sr.created_at >= p_month_start
          AND sr.created_at < p_month_end
      ), 0),
      coalesce((
        SELECT count(*)::integer
        FROM public.investment_reports ir
        WHERE ir.user_id = p_user_id
          AND ir.created_at >= p_month_start
          AND ir.created_at < p_month_end
      ), 0)
    )
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.count_user_reports_in_period (uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_user_reports_in_period (uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_investment_report_quota ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prof RECORD;
  v_sub RECORD;
  v_plan RECORD;
  v_limit integer;
  v_used integer;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_month_key text;
  v_usage public.usage_counters %ROWTYPE;
  v_has_entitled_sub boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.subscription_limits_bypass(v_uid) THEN
    RETURN;
  END IF;

  SELECT role, subscription_status, free_uses_remaining
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_month_key := public.subscription_month_key();
  v_month_start := date_trunc('month', now());
  v_month_end := v_month_start + interval '1 month';

  SELECT plan_code, status, trial_start, trial_end, current_period_start, current_period_end
  INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  IF FOUND AND v_sub.status IN ('active', 'trialing', 'pending_payment') THEN
    v_has_entitled_sub := true;

    SELECT max_reports_per_month, has_unlimited_reports
    INTO v_plan
    FROM public.subscription_plans
    WHERE code = v_sub.plan_code
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subscription plan not found or inactive.';
    END IF;

    IF v_plan.has_unlimited_reports OR v_plan.max_reports_per_month IS NULL THEN
      RETURN;
    END IF;

    v_limit := v_plan.max_reports_per_month;

    IF v_sub.status = 'trialing'
      AND v_sub.trial_start IS NOT NULL
      AND v_sub.trial_end IS NOT NULL THEN
      v_month_start := v_sub.trial_start;
      v_month_end := v_sub.trial_end;
      v_month_key := public.subscription_month_key(v_sub.trial_start);
    ELSIF v_sub.current_period_start IS NOT NULL
      AND v_sub.current_period_end IS NOT NULL THEN
      v_month_start := v_sub.current_period_start;
      v_month_end := v_sub.current_period_end;
      v_month_key := public.subscription_month_key(v_sub.current_period_start);
    END IF;

    v_usage := public.get_or_create_usage_counter(v_month_key);

    v_used := greatest(
      v_usage.reports_generated,
      public.count_user_reports_in_period(v_uid, v_month_start, v_month_end)
    );

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'You have reached your monthly report limit.';
    END IF;

    RETURN;
  END IF;

  IF FOUND AND NOT v_has_entitled_sub THEN
    RAISE EXCEPTION 'Subscription is not active. Renew or choose a plan to generate reports.';
  END IF;

  -- Legacy profile without entitled subscription: free_uses_remaining on calculator PDFs
  v_limit := coalesce(v_prof.free_uses_remaining, 0);
  IF v_limit <= 0 THEN
    RAISE EXCEPTION 'Report limit reached. Choose the free Starter plan or upgrade to continue.';
  END IF;

  SELECT count(*)::integer
  INTO v_used
  FROM public.stored_reports sr
  WHERE sr.user_id = v_uid
    AND sr.report_type = 'CALCULATION';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'You have reached your monthly report limit.';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.assert_investment_report_quota () IS
  'Raises before generating a billable PDF report. Uses usage_counters + stored/investment report rows. Admin/bootstrap bypass.';

-- ---------------------------------------------------------------------------
-- 3) Applicant invite link limit (on new invite insert)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_can_create_application_link (p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_active integer;
  v_cap integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF public.subscription_limits_bypass(p_user_id) THEN
    RETURN;
  END IF;

  SELECT us.plan_code, us.status
  INTO v_sub
  FROM public.user_subscriptions us
  WHERE us.user_id = p_user_id;

  IF NOT FOUND OR v_sub.status NOT IN ('active', 'trialing', 'pending_payment') THEN
    RETURN;
  END IF;

  SELECT sp.max_application_links, sp.has_application_links
  INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.code = v_sub.plan_code
    AND sp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan not found or inactive.';
  END IF;

  IF NOT v_plan.has_application_links
    AND (v_plan.max_application_links IS NULL OR v_plan.max_application_links <= 0) THEN
    RAISE EXCEPTION 'Applicant links are not included on your current plan. Upgrade to enable application links.';
  END IF;

  IF v_plan.max_application_links IS NULL THEN
    RETURN;
  END IF;

  v_cap := v_plan.max_application_links;

  SELECT count(*)::integer
  INTO v_active
  FROM public.applicant_invites i
  WHERE i.user_id = p_user_id
    AND i.revoked_at IS NULL;

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'Applicant link limit reached. Upgrade your plan to create more application links.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_create_application_link (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_create_application_link (uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_applicant_invite (
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.applicant_invites %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  PERFORM 1
  FROM public.properties p
  WHERE p.id = p_property_id
    AND p.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPERTY_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_row
  FROM public.applicant_invites i
  WHERE i.user_id = v_uid
    AND i.property_id = p_property_id
    AND i.revoked_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM public.assert_can_create_application_link(v_uid);

    INSERT INTO public.applicant_invites (user_id, property_id, unit_id)
    VALUES (v_uid, p_property_id, p_unit_id)
    RETURNING * INTO v_row;
  ELSIF p_unit_id IS NOT NULL AND v_row.unit_id IS DISTINCT FROM p_unit_id THEN
    UPDATE public.applicant_invites
    SET
      unit_id = p_unit_id,
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'token', v_row.token,
    'propertyId', v_row.property_id,
    'unitId', v_row.unit_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_applicant_invite (uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.assert_can_create_application_link (uuid) IS
  'Raises when active applicant_invites count is at plan max_application_links. Reuses per-property invite do not count as new.';
