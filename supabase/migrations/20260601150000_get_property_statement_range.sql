-- Property statement ledger for an inclusive UTC date range (one round-trip for the Statement tab).
-- Reuses get_property_monthly_statement row builder; running balance is recomputed on the filtered set.

CREATE OR REPLACE FUNCTION public.get_property_statement_range (
  p_property_id uuid,
  p_start_date date,
  p_end_date date,
  p_include_expected boolean DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid ();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM public.properties p
    WHERE
      p.id = p_property_id
      AND p.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  WITH raw AS (
    SELECT
      public.get_property_monthly_statement (
        p_property_id,
        extract(YEAR FROM p_end_date)::integer,
        extract(MONTH FROM p_end_date)::integer,
        p_include_expected
      ) AS payload
  ),
  filtered AS (
    SELECT
      elem AS row
    FROM
      raw,
      LATERAL jsonb_array_elements(coalesce(payload -> 'statementRows', '[]'::jsonb)) AS elem
    WHERE
      (elem ->> 'date')::date >= p_start_date
      AND (elem ->> 'date')::date <= p_end_date
  ),
  ordered AS (
    SELECT
      f.row,
      (f.row ->> 'date')::date AS d,
      f.row ->> 'id' AS rid,
      sum(
        CASE
          WHEN f.row ->> 'source' = 'INVOICE'
          AND upper(coalesce(f.row ->> 'status', '')) <> 'PAID' THEN 0::numeric
          ELSE coalesce((f.row ->> 'credit')::numeric, 0::numeric)
        END - coalesce((f.row ->> 'debit')::numeric, 0::numeric)
      ) OVER (
        ORDER BY
          (f.row ->> 'date')::date,
          f.row ->> 'id' ROWS BETWEEN UNBOUNDED PRECEDING
          AND CURRENT ROW
      ) AS run_bal
    FROM filtered f
  )
  SELECT
    jsonb_build_object(
      'statementRows',
      coalesce(
        jsonb_agg(
          o.row || jsonb_build_object('balance', round(o.run_bal::numeric, 2))
          ORDER BY
            o.d,
            o.rid
        ),
        '[]'::jsonb
      )
    )
  INTO v_result
  FROM ordered o;

  RETURN coalesce(v_result, jsonb_build_object('statementRows', '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_property_statement_range (uuid, date, date, boolean) FROM PUBLIC;

GRANT
EXECUTE ON FUNCTION public.get_property_statement_range (uuid, date, date, boolean) TO authenticated;

COMMENT ON FUNCTION public.get_property_statement_range (uuid, date, date, boolean) IS
  'Property statement ledger rows for an inclusive UTC date range. SECURITY INVOKER; property must belong to auth.uid(). Reuses get_property_monthly_statement row builder without changing accounting rules.';
