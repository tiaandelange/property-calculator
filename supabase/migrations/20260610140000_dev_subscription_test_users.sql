-- Dev/local: tier test emails, auto-plan on signup for @test.local, service-role-only set_user_plan.
-- Does not add payment wiring. Does not grant set_user_plan to authenticated (anon/public).

-- ---------------------------------------------------------------------------
-- 1) Recognise the four dev tier test inboxes (not admin bypass)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_plan_code_for_test_email (p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_email, '')))
    WHEN 'proplytic.starter@test.local' THEN 'starter'
    WHEN 'proplytic.investor@test.local' THEN 'investor'
    WHEN 'proplytic.portfolio@test.local' THEN 'portfolio'
    WHEN 'proplytic.pro@test.local' THEN 'portfolio_pro'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.dev_plan_code_for_test_email (text) IS
  'Maps dev tier test inboxes to subscription_plans.code. NULL for all other emails.';

CREATE OR REPLACE FUNCTION public.is_dev_subscription_test_email (p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.dev_plan_code_for_test_email(p_email) IS NOT NULL;
$$;

COMMENT ON FUNCTION public.is_dev_subscription_test_email (text) IS
  'True for the four proplytic.*@test.local tier accounts used in local/dev QA.';

-- ---------------------------------------------------------------------------
-- 2) Internal upsert — not granted to API roles (called by definer functions only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._upsert_user_subscription_plan (
  p_user_id uuid,
  p_plan_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans %ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED';
  END IF;

  IF p_plan_code IS NULL OR p_plan_code !~ '^[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'INVALID_PLAN_CODE';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE code = p_plan_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND_OR_INACTIVE: %', p_plan_code;
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id,
    plan_code,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end
  )
  VALUES (
    p_user_id,
    p_plan_code,
    'active',
    NULL,
    NULL,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
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
END;
$$;

REVOKE ALL ON FUNCTION public._upsert_user_subscription_plan (uuid, text) FROM PUBLIC;

COMMENT ON FUNCTION public._upsert_user_subscription_plan (uuid, text) IS
  'Internal: assigns active plan + billing month window. Callable only from other SECURITY DEFINER helpers.';

-- ---------------------------------------------------------------------------
-- 3) set_user_plan — service_role or database owner only (not authenticated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_user_plan (
  target_email text,
  new_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_jwt_role text;
  v_email text := lower(trim(coalesce(target_email, '')));
  v_plan text := lower(trim(coalesce(new_plan, '')));
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()
  );

  IF v_jwt_role IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    RAISE EXCEPTION 'set_user_plan is restricted to service_role or database owner'
      USING ERRCODE = '42501';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'TARGET_EMAIL_REQUIRED';
  END IF;

  IF v_plan = '' THEN
    RAISE EXCEPTION 'NEW_PLAN_REQUIRED';
  END IF;

  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: %', v_email;
  END IF;

  PERFORM public._upsert_user_subscription_plan(v_user_id, v_plan);

  v_is_admin := public.is_bootstrap_admin_email(v_email);

  IF v_is_admin THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    UPDATE public.profiles
    SET
      role = 'ADMIN'::public.app_user_role,
      subscription_status = 'SUBSCRIBED'::public.app_subscription_status,
      free_uses_remaining = NULL,
      email = coalesce(email, v_email),
      updated_at = now()
    WHERE id = v_user_id;
  ELSIF public.is_dev_subscription_test_email(v_email) THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    UPDATE public.profiles
    SET
      role = 'USER'::public.app_user_role,
      subscription_status = 'FREE'::public.app_subscription_status,
      free_uses_remaining = NULL,
      email = coalesce(email, v_email),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'userId', v_user_id::text,
    'email', v_email,
    'planCode', v_plan,
    'status', 'active',
    'isBootstrapAdmin', v_is_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_plan (text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_plan (text, text) TO service_role;

COMMENT ON FUNCTION public.set_user_plan (text, text) IS
  'Dev/ops only: assign subscription_plans.code to an auth user by email. Requires service_role JWT or postgres session.';

-- ---------------------------------------------------------------------------
-- 4) handle_new_user — auto-assign plan for tier test emails on signup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_dev_plan text;
  v_role public.app_user_role;
  v_subscription public.app_subscription_status;
  v_free_uses integer;
BEGIN
  v_is_admin := public.is_bootstrap_admin_email(new.email);
  v_dev_plan := public.dev_plan_code_for_test_email(new.email);
  v_role := CASE WHEN v_is_admin THEN 'ADMIN'::public.app_user_role ELSE 'USER'::public.app_user_role END;
  v_subscription := CASE
    WHEN v_is_admin THEN 'SUBSCRIBED'::public.app_subscription_status
    ELSE 'FREE'::public.app_subscription_status
  END;
  v_free_uses := CASE
    WHEN v_is_admin OR v_dev_plan IS NOT NULL THEN NULL
    ELSE 3
  END;

  INSERT INTO public.profiles (
    id,
    email,
    role,
    subscription_status,
    free_uses_remaining,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    v_role,
    v_subscription,
    v_free_uses,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = coalesce(EXCLUDED.email, public.profiles.email),
    role = CASE
      WHEN v_is_admin THEN 'ADMIN'::public.app_user_role
      ELSE public.profiles.role
    END,
    subscription_status = CASE
      WHEN v_is_admin THEN 'SUBSCRIBED'::public.app_subscription_status
      ELSE public.profiles.subscription_status
    END,
    free_uses_remaining = CASE
      WHEN v_is_admin OR v_dev_plan IS NOT NULL THEN NULL
      ELSE public.profiles.free_uses_remaining
    END,
    updated_at = now();

  IF v_is_admin THEN
    PERFORM public._upsert_user_subscription_plan(new.id, 'portfolio_pro');
  ELSIF v_dev_plan IS NOT NULL THEN
    PERFORM public._upsert_user_subscription_plan(new.id, v_dev_plan);
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'After auth.users insert: profiles + bootstrap admin or dev tier test plan (proplytic.*@test.local).';
