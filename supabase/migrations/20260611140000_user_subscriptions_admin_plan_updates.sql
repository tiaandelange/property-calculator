-- Restrict client-side plan/status changes on user_subscriptions to admins (and service role).
-- Prevents non-admin users from bypassing UI gating via direct Supabase updates.

CREATE OR REPLACE FUNCTION public.user_subscriptions_guard_plan_fields ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()
  );

  IF jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.subscription_limits_bypass(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_code IS DISTINCT FROM OLD.plan_code
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.trial_start IS DISTINCT FROM OLD.trial_start
    OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
    OR NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
    OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'Plan changes are restricted. Contact support or use an admin account for testing.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_subscriptions_guard_plan_fields ON public.user_subscriptions;

CREATE TRIGGER user_subscriptions_guard_plan_fields
BEFORE INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.user_subscriptions_guard_plan_fields();

COMMENT ON FUNCTION public.user_subscriptions_guard_plan_fields () IS
  'Blocks authenticated users from changing plan_code/status unless ADMIN, bootstrap/SUBSCRIBED bypass, or service role.';
