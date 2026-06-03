-- Plan-linked subscriptions v2: feature flags, usage_counters, code PK on subscription_plans.
-- No payment provider wiring. Preserves profiles.role ADMIN for bootstrap owner.

-- ---------------------------------------------------------------------------
-- 1) subscription_plans — add v2 columns, migrate from legacy names, drop uuid PK
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_properties integer,
  ADD COLUMN IF NOT EXISTS max_reports_per_month integer,
  ADD COLUMN IF NOT EXISTS max_application_links integer,
  ADD COLUMN IF NOT EXISTS max_units integer,
  ADD COLUMN IF NOT EXISTS has_basic_management boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_basic_calculators boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_full_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_irr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_graphs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_forecasting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_portfolio_dashboard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_property_comparison boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_advanced_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_unlimited_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_application_links boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_report_branding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_team_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_priority_support boolean NOT NULL DEFAULT false;

-- Backfill from legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'property_limit'
  ) THEN
    UPDATE public.subscription_plans
    SET
      max_properties = property_limit,
      max_reports_per_month = report_limit,
      has_basic_management = coalesce(includes_management, has_basic_management),
      has_basic_calculators = coalesce(includes_calculators, has_basic_calculators),
      has_unlimited_reports = coalesce(includes_unlimited_reports, has_unlimited_reports),
      has_application_links = coalesce(includes_management, has_application_links);
  END IF;
END;
$$;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_property_limit_chk,
  DROP CONSTRAINT IF EXISTS subscription_plans_report_limit_chk,
  DROP CONSTRAINT IF EXISTS subscription_plans_trial_days_chk;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS trial_days,
  DROP COLUMN IF EXISTS property_limit,
  DROP COLUMN IF EXISTS report_limit,
  DROP COLUMN IF EXISTS includes_calculators,
  DROP COLUMN IF EXISTS includes_management,
  DROP COLUMN IF EXISTS includes_unlimited_reports;

-- FK references UNIQUE on code (subscription_plans_code_key), not uuid id — drop before PK swap.
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_plan_code_fkey;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_pkey;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS id;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_code_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'subscription_plans'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (code);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_plan_code_fkey'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_plan_code_fkey
      FOREIGN KEY (plan_code)
      REFERENCES public.subscription_plans (code)
      ON UPDATE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_max_properties_chk CHECK (max_properties IS NULL OR max_properties > 0),
  ADD CONSTRAINT subscription_plans_max_reports_chk CHECK (max_reports_per_month IS NULL OR max_reports_per_month > 0),
  ADD CONSTRAINT subscription_plans_max_application_links_chk CHECK (max_application_links IS NULL OR max_application_links > 0),
  ADD CONSTRAINT subscription_plans_max_units_chk CHECK (max_units IS NULL OR max_units > 0);

COMMENT ON TABLE public.subscription_plans IS
  'Sellable tiers with limits and feature flags. code is the primary key; admin/service role only for writes.';

COMMENT ON COLUMN public.subscription_plans.max_reports_per_month IS
  'NULL with has_unlimited_reports means no monthly cap on investment PDF reports.';

-- ---------------------------------------------------------------------------
-- 2) user_subscriptions — normalize statuses, default active
-- ---------------------------------------------------------------------------

UPDATE public.user_subscriptions
SET
  status = 'active',
  updated_at = now()
WHERE
  status = 'active_manual';

UPDATE public.user_subscriptions
SET
  status = 'expired',
  updated_at = now()
WHERE
  status = 'past_due';

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_chk;

ALTER TABLE public.user_subscriptions
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_chk CHECK (
    status IN ('active', 'trialing', 'pending_payment', 'cancelled', 'expired')
  );

COMMENT ON COLUMN public.user_subscriptions.status IS
  'active: entitled without payment provider; trialing: trial window; pending_payment: plan chosen, billing not connected; cancelled/expired: not entitled.';

-- ---------------------------------------------------------------------------
-- 3) usage_counters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month_key text NOT NULL,
  reports_generated integer NOT NULL DEFAULT 0,
  application_links_active integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_counters_month_key_chk CHECK (month_key ~ '^\d{4}-\d{2}$'),
  CONSTRAINT usage_counters_reports_generated_chk CHECK (reports_generated >= 0),
  CONSTRAINT usage_counters_application_links_active_chk CHECK (application_links_active >= 0),
  CONSTRAINT usage_counters_user_month_unique UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS usage_counters_user_id_idx ON public.usage_counters (user_id);

COMMENT ON TABLE public.usage_counters IS
  'Per-user monthly usage for plan limits (reports, application links).';

DROP TRIGGER IF EXISTS usage_counters_set_updated_at ON public.usage_counters;

CREATE TRIGGER usage_counters_set_updated_at
BEFORE UPDATE ON public.usage_counters
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_counters TO authenticated;

DROP POLICY IF EXISTS usage_counters_select_own ON public.usage_counters;
CREATE POLICY usage_counters_select_own ON public.usage_counters
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_insert_own ON public.usage_counters;
CREATE POLICY usage_counters_insert_own ON public.usage_counters
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_update_own ON public.usage_counters;
CREATE POLICY usage_counters_update_own ON public.usage_counters
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS usage_counters_delete_own ON public.usage_counters;
CREATE POLICY usage_counters_no_client_delete ON public.usage_counters
FOR DELETE TO authenticated
USING (FALSE);

-- ---------------------------------------------------------------------------
-- 4) Helpers — month key + usage row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.subscription_month_key (p_ts timestamptz DEFAULT now())
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(coalesce(p_ts, now()) AT TIME ZONE 'UTC', 'YYYY-MM');
$$;

COMMENT ON FUNCTION public.subscription_month_key IS
  'UTC YYYY-MM bucket for usage_counters.month_key.';

CREATE OR REPLACE FUNCTION public.get_or_create_usage_counter (p_month_key text DEFAULT NULL)
RETURNS public.usage_counters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := coalesce(nullif(trim(p_month_key), ''), public.subscription_month_key());
  v_row public.usage_counters %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_row
  FROM public.usage_counters
  WHERE user_id = v_uid AND month_key = v_key;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.usage_counters (user_id, month_key)
  VALUES (v_uid, v_key)
  ON CONFLICT (user_id, month_key) DO NOTHING;

  SELECT * INTO v_row
  FROM public.usage_counters
  WHERE user_id = v_uid AND month_key = v_key;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_usage_counter (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_usage_counter (text) TO authenticated;

-- Entitlements for gating (own user or ADMIN bypass in callers)
CREATE OR REPLACE FUNCTION public.get_user_plan_entitlements ()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof RECORD;
  v_sub RECORD;
  v_plan RECORD;
  v_usage public.usage_counters %ROWTYPE;
  v_month text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT role, subscription_status INTO v_prof
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_prof.role = 'ADMIN'::public.app_user_role THEN
    RETURN jsonb_build_object(
      'isAdmin', true,
      'planCode', 'portfolio_pro',
      'status', 'active',
      'limitsActive', false
    );
  END IF;

  SELECT * INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'isAdmin', false,
      'planCode', null,
      'status', null,
      'limitsActive', false
    );
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE code = v_sub.plan_code AND is_active = true;

  v_month := public.subscription_month_key();
  v_usage := public.get_or_create_usage_counter(v_month);

  RETURN jsonb_build_object(
    'isAdmin', false,
    'planCode', v_sub.plan_code,
    'status', v_sub.status,
    'limitsActive', v_sub.status IN ('active', 'trialing', 'pending_payment'),
    'plan', to_jsonb(v_plan),
    'usage', jsonb_build_object(
      'monthKey', v_usage.month_key,
      'reportsGenerated', v_usage.reports_generated,
      'applicationLinksActive', v_usage.application_links_active
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_plan_entitlements () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_plan_entitlements () TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Quota RPCs — use v2 plan columns + usage_counters
-- ---------------------------------------------------------------------------

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
  v_stored_count integer;
  v_investment_count integer;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_month_key text;
  v_usage public.usage_counters %ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, subscription_status, free_uses_remaining
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_prof.role = 'ADMIN'::public.app_user_role
    OR v_prof.subscription_status = 'SUBSCRIBED'::public.app_subscription_status THEN
    RETURN;
  END IF;

  v_month_key := public.subscription_month_key();
  v_month_start := date_trunc('month', now());
  v_month_end := v_month_start + interval '1 month';

  SELECT plan_code, status, trial_start, trial_end, current_period_start, current_period_end
  INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = v_uid;

  IF FOUND AND v_sub.status IN ('active', 'trialing', 'pending_payment') THEN
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

    SELECT count(*)::integer
    INTO v_stored_count
    FROM public.stored_reports sr
    WHERE sr.user_id = v_uid
      AND sr.report_type IN ('CALCULATION', 'INVESTMENT_REPORT', 'PROPERTY_SUMMARY')
      AND sr.created_at >= v_month_start
      AND sr.created_at < v_month_end;

    SELECT count(*)::integer
    INTO v_investment_count
    FROM public.investment_reports ir
    WHERE ir.user_id = v_uid
      AND ir.created_at >= v_month_start
      AND ir.created_at < v_month_end;

    v_used := greatest(
      v_usage.reports_generated,
      coalesce(v_stored_count, 0),
      coalesce(v_investment_count, 0)
    );

    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'You have reached your monthly report limit.';
    END IF;

    RETURN;
  END IF;

  IF FOUND THEN
    RAISE EXCEPTION 'Subscription is not active. Renew or choose a plan to generate reports.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.increment_usage_reports_generated (p_delta integer DEFAULT 1)
RETURNS public.usage_counters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.usage_counters %ROWTYPE;
  v_key text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_delta IS NULL OR p_delta < 0 THEN
    RAISE EXCEPTION 'INVALID_DELTA';
  END IF;

  v_key := public.subscription_month_key();
  v_row := public.get_or_create_usage_counter(v_key);

  UPDATE public.usage_counters
  SET reports_generated = reports_generated + p_delta, updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_reports_generated (integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage_reports_generated (integer) TO authenticated;

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
  v_uid uuid := auth.uid();
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

  SELECT id, role, subscription_status, free_uses_remaining
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_unlimited := v_prof.role = 'ADMIN'::public.app_user_role
    OR v_prof.subscription_status = 'SUBSCRIBED'::public.app_subscription_status;

  IF NOT v_unlimited THEN
    SELECT us.plan_code, us.status
    INTO v_sub
    FROM public.user_subscriptions us
    WHERE us.user_id = v_uid;

    IF FOUND
      AND v_sub.plan_code = 'starter'
      AND v_sub.status IN ('active', 'trialing', 'pending_payment') THEN
      v_on_starter_plan := true;
    END IF;

    IF NOT v_on_starter_plan AND coalesce(v_prof.free_uses_remaining, 0) <= 0 THEN
      RAISE EXCEPTION 'Free usage exhausted. Choose the free Starter plan or upgrade for more access.';
    END IF;
  END IF;

  INSERT INTO public.calculator_results (user_id, type, input_json, result_json)
  VALUES (v_uid, trim(p_type), p_input, p_result)
  RETURNING id INTO v_id;

  IF NOT v_unlimited AND NOT v_on_starter_plan THEN
    v_new_free := greatest(coalesce(v_prof.free_uses_remaining, 0) - 1, 0);

    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    UPDATE public.profiles
    SET free_uses_remaining = v_new_free, updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id::text,
    'type', trim(p_type),
    'input', p_input,
    'result', p_result,
    'freeUsesRemaining',
    CASE
      WHEN v_unlimited THEN to_jsonb(v_prof.free_uses_remaining)
      WHEN v_on_starter_plan THEN to_jsonb(NULL::integer)
      ELSE to_jsonb(v_new_free)
    END
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6) Seed subscription_plans (idempotent on code PK)
-- ---------------------------------------------------------------------------

INSERT INTO public.subscription_plans (
  code,
  name,
  monthly_price,
  currency,
  description,
  max_properties,
  max_reports_per_month,
  max_application_links,
  max_units,
  has_basic_management,
  has_basic_calculators,
  has_full_analytics,
  has_irr,
  has_graphs,
  has_forecasting,
  has_portfolio_dashboard,
  has_property_comparison,
  has_advanced_reports,
  has_unlimited_reports,
  has_application_links,
  has_report_branding,
  has_team_access,
  has_priority_support,
  is_active,
  sort_order
)
VALUES
  (
    'starter',
    'Starter',
    0,
    'ZAR',
    'Free plan for your first properties — basic management and calculators.',
    3,
    3,
    1,
    NULL,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    10
  ),
  (
    'investor',
    'Investor',
    299,
    'ZAR',
    'For owner-managers and small portfolio investors.',
    10,
    10,
    10,
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    20
  ),
  (
    'portfolio',
    'Portfolio',
    599,
    'ZAR',
    'For serious property investors managing a growing portfolio.',
    30,
    NULL,
    NULL,
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    true,
    true,
    30
  ),
  (
    'portfolio_pro',
    'Portfolio Pro',
    999,
    'ZAR',
    'For larger owner-managed portfolios and advanced reporting.',
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    40
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  max_properties = EXCLUDED.max_properties,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  max_application_links = EXCLUDED.max_application_links,
  max_units = EXCLUDED.max_units,
  has_basic_management = EXCLUDED.has_basic_management,
  has_basic_calculators = EXCLUDED.has_basic_calculators,
  has_full_analytics = EXCLUDED.has_full_analytics,
  has_irr = EXCLUDED.has_irr,
  has_graphs = EXCLUDED.has_graphs,
  has_forecasting = EXCLUDED.has_forecasting,
  has_portfolio_dashboard = EXCLUDED.has_portfolio_dashboard,
  has_property_comparison = EXCLUDED.has_property_comparison,
  has_advanced_reports = EXCLUDED.has_advanced_reports,
  has_unlimited_reports = EXCLUDED.has_unlimited_reports,
  has_application_links = EXCLUDED.has_application_links,
  has_report_branding = EXCLUDED.has_report_branding,
  has_team_access = EXCLUDED.has_team_access,
  has_priority_support = EXCLUDED.has_priority_support,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Starter rows: ensure active (was active_manual)
UPDATE public.user_subscriptions
SET status = 'active', updated_at = now()
WHERE plan_code = 'starter' AND status NOT IN ('cancelled', 'expired');

-- ---------------------------------------------------------------------------
-- 7) Admin owner — profiles.role ADMIN + portfolio_pro subscription
-- ---------------------------------------------------------------------------

UPDATE public.profiles p
SET
  role = 'ADMIN'::public.app_user_role,
  subscription_status = 'SUBSCRIBED'::public.app_subscription_status,
  free_uses_remaining = NULL,
  email = coalesce(p.email, u.email),
  updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND public.is_bootstrap_admin_email(u.email);

INSERT INTO public.user_subscriptions (
  user_id,
  plan_code,
  status,
  current_period_start,
  current_period_end
)
SELECT
  u.id,
  'portfolio_pro',
  'active',
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month'
FROM auth.users u
WHERE public.is_bootstrap_admin_email(u.email)
ON CONFLICT (user_id) DO UPDATE
SET
  plan_code = EXCLUDED.plan_code,
  status = EXCLUDED.status,
  trial_start = NULL,
  trial_end = NULL,
  current_period_start = coalesce(
    user_subscriptions.current_period_start,
    EXCLUDED.current_period_start
  ),
  current_period_end = coalesce(
    user_subscriptions.current_period_end,
    EXCLUDED.current_period_end
  ),
  updated_at = now();

-- Backfill usage_counters for current month from stored_reports
INSERT INTO public.usage_counters (user_id, month_key, reports_generated)
SELECT
  sr.user_id,
  public.subscription_month_key(sr.created_at),
  count(*)::integer
FROM public.stored_reports sr
WHERE sr.report_type = 'CALCULATION'
  AND sr.created_at >= date_trunc('month', now())
  AND sr.created_at < date_trunc('month', now()) + interval '1 month'
GROUP BY sr.user_id, public.subscription_month_key(sr.created_at)
ON CONFLICT (user_id, month_key) DO UPDATE
SET
  reports_generated = greatest(
    public.usage_counters.reports_generated,
    EXCLUDED.reports_generated
  ),
  updated_at = now();
