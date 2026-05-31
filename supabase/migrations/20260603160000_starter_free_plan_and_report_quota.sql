-- Starter tier: permanently free with 3 investment PDF reports per calendar month.

UPDATE public.subscription_plans
SET
  monthly_price = 0,
  trial_days = 0,
  description = 'Free plan for your first properties — 3 investment reports per month.',
  report_limit = 3,
  updated_at = now()
WHERE
  code = 'starter';

UPDATE public.user_subscriptions
SET
  status = 'active_manual',
  trial_start = NULL,
  trial_end = NULL,
  current_period_start = date_trunc('month', now()),
  current_period_end = date_trunc('month', now()) + interval '1 month',
  updated_at = now()
WHERE
  plan_code = 'starter'
  AND status IN ('trialing', 'pending_payment');

CREATE OR REPLACE FUNCTION public.save_calculation_and_decrement_free_use (
  p_type text,
  p_input jsonb,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid ();
  v_prof RECORD;
  v_sub RECORD;
  v_unlimited boolean;
  v_on_starter_plan boolean := false;
  v_new_free integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(coalesce(p_type, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid calculation type';
  END IF;

  SELECT
    id,
    role,
    subscription_status,
    free_uses_remaining
  INTO v_prof
  FROM
    public.profiles
  WHERE
    id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_unlimited := v_prof.role = 'ADMIN'::public.app_user_role
  OR v_prof.subscription_status = 'SUBSCRIBED'::public.app_subscription_status;

  IF NOT v_unlimited THEN
    SELECT
      us.plan_code,
      us.status
    INTO v_sub
    FROM
      public.user_subscriptions us
    WHERE
      us.user_id = v_uid;

    IF FOUND
      AND v_sub.plan_code = 'starter'
      AND v_sub.status IN ('active_manual', 'trialing', 'active', 'pending_payment') THEN
      v_on_starter_plan := true;
    END IF;

    IF NOT v_on_starter_plan
      AND coalesce(v_prof.free_uses_remaining, 0) <= 0 THEN
      RAISE EXCEPTION 'Free usage exhausted. Choose the free Starter plan or upgrade for more access.';
    END IF;
  END IF;

  INSERT INTO public.calculator_results (
    user_id,
    type,
    input_json,
    result_json
  )
  VALUES (
    v_uid,
    trim(p_type),
    p_input,
    p_result
  )
RETURNING
  id INTO v_id;

  IF NOT v_unlimited AND NOT v_on_starter_plan THEN
    v_new_free := greatest(coalesce(v_prof.free_uses_remaining, 0) - 1, 0);

    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    UPDATE public.profiles
    SET
      free_uses_remaining = v_new_free,
      updated_at = now()
    WHERE
      id = v_uid;
  END IF;

  RETURN jsonb_build_object (
    'id',
    v_id::text,
    'type',
    trim(p_type),
    'input',
    p_input,
    'result',
    p_result,
    'freeUsesRemaining',
    CASE
      WHEN v_unlimited THEN to_jsonb (v_prof.free_uses_remaining)
      WHEN v_on_starter_plan THEN to_jsonb (NULL::integer)
      ELSE to_jsonb (v_new_free)
    END
  );
END;
$function$;

COMMENT ON FUNCTION public.save_calculation_and_decrement_free_use IS
  'Saves calculator_results for auth.uid(). Starter plan users save without decrementing free_uses_remaining; legacy users use free_uses_remaining.';

-- Monthly investment report quota (CALCULATION PDFs) for plan-aware users.
CREATE OR REPLACE FUNCTION public.assert_investment_report_quota ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid ();
  v_prof RECORD;
  v_sub RECORD;
  v_plan RECORD;
  v_limit integer;
  v_used integer;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    role,
    subscription_status,
    free_uses_remaining
  INTO v_prof
  FROM
    public.profiles
  WHERE
    id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_prof.role = 'ADMIN'::public.app_user_role
    OR v_prof.subscription_status = 'SUBSCRIBED'::public.app_subscription_status THEN
    RETURN;
  END IF;

  v_month_start := date_trunc('month', now());
  v_month_end := v_month_start + interval '1 month';

  SELECT
    us.plan_code,
    us.status,
    us.trial_start,
    us.trial_end,
    us.current_period_start,
    us.current_period_end
  INTO v_sub
  FROM
    public.user_subscriptions us
  WHERE
    us.user_id = v_uid;

  IF FOUND THEN
    SELECT
      sp.report_limit,
      sp.includes_unlimited_reports
    INTO v_plan
    FROM
      public.subscription_plans sp
    WHERE
      sp.code = v_sub.plan_code
      AND sp.is_active = true;

    IF v_plan.includes_unlimited_reports OR v_plan.report_limit IS NULL THEN
      RETURN;
    END IF;

    v_limit := v_plan.report_limit;

    IF v_sub.status = 'trialing'
      AND v_sub.trial_start IS NOT NULL
      AND v_sub.trial_end IS NOT NULL THEN
      v_month_start := v_sub.trial_start;
      v_month_end := v_sub.trial_end;
    ELSIF v_sub.current_period_start IS NOT NULL
      AND v_sub.current_period_end IS NOT NULL THEN
      v_month_start := v_sub.current_period_start;
      v_month_end := v_sub.current_period_end;
    END IF;
  ELSE
    v_limit := coalesce(v_prof.free_uses_remaining, 0);
    IF v_limit <= 0 THEN
      RAISE EXCEPTION 'Report limit reached. Choose the free Starter plan or upgrade to continue.';
    END IF;
    -- Legacy profile quota: count all CALCULATION reports (lifetime), not monthly.
    SELECT
      count(*)::integer INTO v_used
    FROM
      public.stored_reports sr
    WHERE
      sr.user_id = v_uid
      AND sr.report_type = 'CALCULATION';

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'Report limit reached. Choose the free Starter plan or upgrade to continue.';
    END IF;

    RETURN;
  END IF;

  SELECT
    count(*)::integer INTO v_used
  FROM
    public.stored_reports sr
  WHERE
    sr.user_id = v_uid
    AND sr.report_type = 'CALCULATION'
    AND sr.created_at >= v_month_start
    AND sr.created_at < v_month_end;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Monthly report limit reached (%). Upgrade your plan to generate more investment reports.', v_limit;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assert_investment_report_quota () TO authenticated;

COMMENT ON FUNCTION public.assert_investment_report_quota IS
  'Raises when auth.uid() cannot generate another CALCULATION PDF this period. Starter: 3/month; legacy profiles use free_uses_remaining lifetime count.';
