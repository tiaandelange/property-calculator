-- Bootstrap owner admin: full app access without Stripe.
-- Matches legacy Prisma seed (backend/scripts/legacy-prisma-migration/prisma/seed.ts).

-- ---------------------------------------------------------------------------
-- 1) Hardcoded bootstrap admin emails (lowercase match)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_bootstrap_admin_email (p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(p_email, ''))) = ANY (
    ARRAY['delangetiaan13@gmail.com']::text[]
  );
$$;

COMMENT ON FUNCTION public.is_bootstrap_admin_email (text) IS
  'True for owner/bootstrap emails that receive ADMIN + SUBSCRIBED without Stripe.';

-- ---------------------------------------------------------------------------
-- 2) Promote existing user(s) already in auth.users / public.profiles
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

UPDATE public.profiles p
SET
  role = 'ADMIN'::public.app_user_role,
  subscription_status = 'SUBSCRIBED'::public.app_subscription_status,
  free_uses_remaining = NULL,
  updated_at = now()
WHERE public.is_bootstrap_admin_email(p.email)
  AND (
    p.role IS DISTINCT FROM 'ADMIN'::public.app_user_role
    OR p.subscription_status IS DISTINCT FROM 'SUBSCRIBED'::public.app_subscription_status
    OR p.free_uses_remaining IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 3) handle_new_user — provision ADMIN + SUBSCRIBED for bootstrap emails
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_role public.app_user_role;
  v_subscription public.app_subscription_status;
  v_free_uses integer;
BEGIN
  v_is_admin := public.is_bootstrap_admin_email(new.email);
  v_role := CASE WHEN v_is_admin THEN 'ADMIN'::public.app_user_role ELSE 'USER'::public.app_user_role END;
  v_subscription := CASE
    WHEN v_is_admin THEN 'SUBSCRIBED'::public.app_subscription_status
    ELSE 'FREE'::public.app_subscription_status
  END;
  v_free_uses := CASE WHEN v_is_admin THEN NULL ELSE 3 END;

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
        WHEN v_is_admin THEN NULL
        ELSE public.profiles.free_uses_remaining
      END,
      updated_at = now();
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'After auth.users insert: provisions profiles; bootstrap admin emails get ADMIN + SUBSCRIBED.';
