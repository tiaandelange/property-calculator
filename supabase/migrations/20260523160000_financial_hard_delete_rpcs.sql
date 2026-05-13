-- Hard-delete ledger rows (authenticated clients have DELETE revoked on income/expense).
-- SECURITY DEFINER: bypasses RLS; caller identity is enforced with user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.hard_delete_income_entry (p_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  DELETE FROM public.income_entries
  WHERE id = p_id
    AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'INCOME_NOT_FOUND';
  END IF;
  RETURN jsonb_build_object('message', 'Deleted');
END;
$$;

COMMENT ON FUNCTION public.hard_delete_income_entry (uuid) IS 'Hard-deletes an income entry owned by auth.uid(); SPA use when RLS revokes DELETE.';

CREATE OR REPLACE FUNCTION public.hard_delete_expense_entry (p_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_row public.expense_entries %ROWTYPE;
  v_n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  SELECT
    * INTO v_row
  FROM
    public.expense_entries
  WHERE
    id = p_id
    AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND';
  END IF;
  IF v_row.recurring_schedule_parent_id IS NOT NULL THEN
    UPDATE
      public.expense_entries e
    SET
      status = 'ARCHIVED'::public.app_property_expense_status,
      archived_at = now(),
      updated_at = now()
    WHERE
      e.id = p_id
      AND e.user_id = v_uid;
    RETURN jsonb_build_object('message', 'Archived', 'archived', TRUE);
  END IF;
  DELETE FROM public.expense_entries
  WHERE id = p_id
    AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND';
  END IF;
  RETURN jsonb_build_object('message', 'Deleted', 'archived', FALSE);
END;
$$;

COMMENT ON FUNCTION public.hard_delete_expense_entry (uuid) IS 'Hard-deletes a one-off expense; archives posted recurring instances (Express parity).';

GRANT EXECUTE ON FUNCTION public.hard_delete_income_entry (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.hard_delete_expense_entry (uuid) TO authenticated;
