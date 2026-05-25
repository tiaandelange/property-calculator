-- Profile updates: RPC for invoice_payment_details; block privileged column writes from authenticated JWT.

-- ---------------------------------------------------------------------------
-- 1) Harden BEFORE UPDATE trigger (authenticated JWT only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.profiles_prevent_authenticated_billing_updates ()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
    RETURN new;
  END IF;

  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.role()
  );

  IF jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN new;
  END IF;

  IF new.role IS DISTINCT FROM old.role
    OR new.subscription_status IS DISTINCT FROM old.subscription_status THEN
    RAISE EXCEPTION 'role and subscription_status may only be changed by the server (service role)'
      USING ERRCODE = '42501';
  END IF;

  IF new.free_uses_remaining IS DISTINCT FROM old.free_uses_remaining THEN
    RAISE EXCEPTION 'free_uses_remaining may only be changed by server functions (e.g. save_calculation_and_decrement_free_use)'
      USING ERRCODE = '42501';
  END IF;

  IF new.invoice_payment_details IS DISTINCT FROM old.invoice_payment_details THEN
    RAISE EXCEPTION 'invoice_payment_details must be updated via update_invoice_payment_details()'
      USING ERRCODE = '42501';
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.profiles_prevent_authenticated_billing_updates () IS
  'Blocks authenticated clients from changing billing/subscription columns and invoice_payment_details (use RPC).';

-- ---------------------------------------------------------------------------
-- 2) RPC — update invoice payment details JSON for auth.uid()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_invoice_payment_details (p_details jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_details IS NOT NULL AND jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_details must be a JSON object';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET
    invoice_payment_details = p_details,
    updated_at = now()
  WHERE
    id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('invoicePaymentDetails', p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_payment_details (jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_invoice_payment_details (jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_invoice_payment_details (jsonb) IS
  'Sets profiles.invoice_payment_details for auth.uid(); bypasses direct authenticated UPDATE block on that column.';

-- ---------------------------------------------------------------------------
-- 3) save_calculation_and_decrement_free_use — set bypass before profile UPDATE
-- ---------------------------------------------------------------------------

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
  v_unlimited boolean;
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

  IF NOT v_unlimited AND coalesce(v_prof.free_uses_remaining, 0) <= 0 THEN
    RAISE EXCEPTION 'Free usage exhausted. Subscribe for R99/month.';
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

  IF NOT v_unlimited THEN
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
      ELSE to_jsonb (v_new_free)
    END
  );
END;
$function$;
