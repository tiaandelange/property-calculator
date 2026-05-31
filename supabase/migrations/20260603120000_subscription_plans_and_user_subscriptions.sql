-- Subscription plan catalog + per-user plan selection (no payment provider wiring).
-- Legacy public.subscriptions (Stripe provider periods) is unchanged.

-- ---------------------------------------------------------------------------
-- 1) Plan catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  trial_days integer NOT NULL DEFAULT 0,
  property_limit integer,
  report_limit integer,
  includes_calculators boolean NOT NULL DEFAULT false,
  includes_management boolean NOT NULL DEFAULT false,
  includes_unlimited_reports boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_code_chk CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT subscription_plans_trial_days_chk CHECK (trial_days >= 0),
  CONSTRAINT subscription_plans_property_limit_chk CHECK (property_limit IS NULL OR property_limit > 0),
  CONSTRAINT subscription_plans_report_limit_chk CHECK (report_limit IS NULL OR report_limit > 0)
);

CREATE INDEX IF NOT EXISTS subscription_plans_active_sort_idx ON public.subscription_plans (is_active, sort_order);

COMMENT ON TABLE public.subscription_plans IS
  'Sellable subscription tiers. Pricing is admin-managed; clients may read active plans only.';

COMMENT ON COLUMN public.subscription_plans.report_limit IS
  'NULL means unlimited when includes_unlimited_reports is true, or plan-specific unlimited reporting.';

-- ---------------------------------------------------------------------------
-- 2) Per-user plan selection (separate from legacy public.subscriptions Stripe rows)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.subscription_plans (code) ON UPDATE CASCADE,
  status text NOT NULL DEFAULT 'trialing',
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_provider text,
  payment_customer_id text,
  payment_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_status_chk CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS user_subscriptions_plan_code_idx ON public.user_subscriptions (plan_code);

CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON public.user_subscriptions (status);

COMMENT ON TABLE public.user_subscriptions IS
  'User-selected plan and lifecycle state. Payment_* columns are placeholders for a future provider; not used yet.';

COMMENT ON COLUMN public.user_subscriptions.payment_provider IS
  'Placeholder for future billing integration (e.g. stripe). Do not populate until payments are enabled.';

-- ---------------------------------------------------------------------------
-- 3) updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS subscription_plans_set_updated_at ON public.subscription_plans;

CREATE TRIGGER subscription_plans_set_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS user_subscriptions_set_updated_at ON public.user_subscriptions;

CREATE TRIGGER user_subscriptions_set_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Block authenticated clients from mutating payment provider placeholders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_subscriptions_prevent_authenticated_payment_updates ()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()
  );

  IF jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN new;
  END IF;

  IF new.payment_provider IS DISTINCT FROM old.payment_provider
    OR new.payment_customer_id IS DISTINCT FROM old.payment_customer_id
    OR new.payment_subscription_id IS DISTINCT FROM old.payment_subscription_id THEN
    RAISE EXCEPTION 'payment provider fields may only be changed by the server (service role)'
      USING ERRCODE = '42501';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS user_subscriptions_prevent_authenticated_payment_updates ON public.user_subscriptions;

CREATE TRIGGER user_subscriptions_prevent_authenticated_payment_updates
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.user_subscriptions_prevent_authenticated_payment_updates ();

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_subscriptions TO authenticated;

DROP POLICY IF EXISTS subscription_plans_select_public ON public.subscription_plans;

CREATE POLICY subscription_plans_select_public ON public.subscription_plans FOR
SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS subscription_plans_no_client_write ON public.subscription_plans;

CREATE POLICY subscription_plans_no_client_insert ON public.subscription_plans FOR
INSERT TO anon, authenticated WITH CHECK (FALSE);

CREATE POLICY subscription_plans_no_client_update ON public.subscription_plans FOR
UPDATE TO anon, authenticated USING (FALSE);

CREATE POLICY subscription_plans_no_client_delete ON public.subscription_plans FOR
DELETE TO anon, authenticated USING (FALSE);

DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;

CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions FOR
SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_subscriptions_insert_own ON public.user_subscriptions;

CREATE POLICY user_subscriptions_insert_own ON public.user_subscriptions FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_subscriptions_update_own ON public.user_subscriptions;

CREATE POLICY user_subscriptions_update_own ON public.user_subscriptions FOR
UPDATE TO authenticated USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_subscriptions_delete_own ON public.user_subscriptions;

CREATE POLICY user_subscriptions_no_client_delete ON public.user_subscriptions FOR
DELETE TO authenticated USING (FALSE);

COMMENT ON POLICY subscription_plans_select_public ON public.subscription_plans IS
  'Public pricing: active plans readable before sign-in. Plan pricing is not client-writable.';

COMMENT ON POLICY user_subscriptions_select_own ON public.user_subscriptions IS
  'Users read only their own plan selection row.';

-- ---------------------------------------------------------------------------
-- 6) Seed plans (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price,
  currency,
  trial_days,
  property_limit,
  report_limit,
  includes_calculators,
  includes_management,
  includes_unlimited_reports,
  is_active,
  sort_order)
VALUES
  (
    'starter',
    'Starter',
    'Start tracking your first properties and portfolio basics.',
    99.00,
    'ZAR',
    14,
    3,
    3,
    false,
    false,
    false,
    true,
    10
  ),
  (
    'investor',
    'Investor',
    'For owner-managers and small portfolio investors.',
    299.00,
    'ZAR',
    0,
    10,
    10,
    true,
    true,
    false,
    true,
    20
  ),
  (
    'portfolio',
    'Portfolio',
    'For serious property investors managing a growing portfolio.',
    599.00,
    'ZAR',
    14,
    30,
    NULL,
    true,
    true,
    true,
    true,
    30
  ),
  (
    'portfolio_pro',
    'Portfolio Pro',
    'For larger owner-managed portfolios and advanced reporting.',
    999.00,
    'ZAR',
    0,
    75,
    NULL,
    true,
    true,
    true,
    true,
    40
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  currency = EXCLUDED.currency,
  trial_days = EXCLUDED.trial_days,
  property_limit = EXCLUDED.property_limit,
  report_limit = EXCLUDED.report_limit,
  includes_calculators = EXCLUDED.includes_calculators,
  includes_management = EXCLUDED.includes_management,
  includes_unlimited_reports = EXCLUDED.includes_unlimited_reports,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
