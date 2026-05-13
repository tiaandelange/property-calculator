-- =============================================================================
-- Supabase Auth → public.profiles provisioning (Phase 2)
-- =============================================================================
-- Supabase Auth owns identity (auth.users). public.profiles holds app fields
-- (subscription UI, invoice payment JSON, preferences). Legacy Express JWT /
-- bcrypt routes remain until cutover — this migration does not remove them.
--
-- Prerequisites: core schema (profiles table, app_* enums), prior RLS migration.
-- Apply after: 20260513140000, 20260515120000, 20260515180000, 20260516140000
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ensure profiles.email exists (Phase 1b migration may have added it)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- ---------------------------------------------------------------------------
-- 2) updated_at helper — idempotent (matches core_application_schema behaviour)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at ()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at () IS
  'Sets NEW.updated_at to now() on UPDATE; shared by user-owned tables.';

-- ---------------------------------------------------------------------------
-- 3) handle_new_user — AFTER INSERT on auth.users → public.profiles
--     free_uses_remaining = 3 matches legacy Prisma default (authRoutes / seed).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    'USER'::public.app_user_role,
    'FREE'::public.app_subscription_status,
    3,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, public.profiles.email),
      updated_at = now();
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'Fires after auth.users insert: provisions public.profiles with app defaults.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- 4) BEFORE UPDATE — authenticated JWT cannot change billing columns;
--     service_role (and elevated DB roles) skips enforcement.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.profiles_prevent_authenticated_billing_updates ()
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

  -- Only enforce for browser/API callers using the authenticated JWT role.
  -- service_role, postgres maintenance, and other roles skip this check.
  IF jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN new;
  END IF;

  IF new.role IS DISTINCT FROM old.role OR new.subscription_status IS DISTINCT FROM old.subscription_status THEN
    RAISE EXCEPTION 'role and subscription_status may only be changed by the server (service role)'
      USING ERRCODE = '42501';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_authenticated_billing_updates ON public.profiles;

CREATE TRIGGER profiles_prevent_authenticated_billing_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_prevent_authenticated_billing_updates ();

COMMENT ON TRIGGER profiles_prevent_authenticated_billing_updates ON public.profiles IS
  'Blocks role/subscription_status changes from authenticated clients; service_role bypasses via JWT claim.';

-- ---------------------------------------------------------------------------
-- 5) RLS — SELECT own row; UPDATE own row without changing billing fields;
--        INSERT self only with safe defaults (trigger is primary path).
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid () = id);

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid () = id)
WITH CHECK (auth.uid () = id);

COMMENT ON POLICY profiles_update_own ON public.profiles IS
  'Own-row updates; role and subscription_status are enforced by trigger profiles_prevent_authenticated_billing_updates for JWT role authenticated.';

CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid () = id
  AND role = 'USER'::public.app_user_role
  AND subscription_status = 'FREE'::public.app_subscription_status
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
