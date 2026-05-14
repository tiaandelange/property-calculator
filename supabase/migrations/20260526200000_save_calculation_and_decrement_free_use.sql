-- Atomically persist a calculator run and apply free-use rules (mirrors Express POST /api/calculations/:type for logged-in users).

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

REVOKE ALL ON FUNCTION public.save_calculation_and_decrement_free_use (text, jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_calculation_and_decrement_free_use (text, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_calculation_and_decrement_free_use (text, jsonb, jsonb) IS
  'Saves public.calculator_results for auth.uid() and decrements free_uses_remaining when not ADMIN/SUBSCRIBED; SECURITY DEFINER.';
