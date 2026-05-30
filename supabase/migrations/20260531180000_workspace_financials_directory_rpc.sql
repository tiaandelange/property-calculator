-- Portfolio Financials directory: one round-trip (replaces N client calls to get_property_monthly_statement).
-- Aggregates summaries, merges ledger rows, filters, paginates server-side.

CREATE OR REPLACE FUNCTION public.get_workspace_financials_directory (
  p_year integer,
  p_month integer,
  p_property_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prop RECORD;
  v_stmt jsonb;
  v_row jsonb;
  v_summary jsonb;
  v_all_rows jsonb := '[]'::jsonb;
  v_filtered jsonb := '[]'::jsonb;
  v_page jsonb := '[]'::jsonb;
  v_properties jsonb := '[]'::jsonb;
  v_warnings text[] := ARRAY[]::text[];
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_source text := nullif(trim(coalesce(p_source, '')), '');
  v_received double precision := 0;
  v_expected double precision := 0;
  v_expenses double precision := 0;
  v_bond double precision := 0;
  v_net double precision := 0;
  v_property_count integer := 0;
  v_total_count integer := 0;
  v_ytd_revenue double precision := 0;
  v_ytd_expenses double precision := 0;
  v_ytd_latest date := NULL;
  v_ytd_start date;
  v_today date := (timezone('UTC', now()))::date;
  v_year_start date;
  v_elem jsonb;
  v_date date;
  v_credit double precision;
  v_debit double precision;
  v_st text;
  v_src text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 25;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  v_year_start := make_date(p_year, 1, 1);
  v_ytd_start := make_date(extract(year FROM v_today)::integer, 1, 1);

  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', p.id::text, 'name', coalesce(p.name, 'Property'))
        ORDER BY coalesce(p.name, 'Property')
      ),
      '[]'::jsonb
    )
  INTO v_properties
  FROM public.properties p
  WHERE
    p.user_id = v_uid
    AND (p_property_id IS NULL OR p.id = p_property_id);

  FOR v_prop IN
    SELECT p.id, coalesce(p.name, 'Property') AS name
    FROM public.properties p
    WHERE
      p.user_id = v_uid
      AND (p_property_id IS NULL OR p.id = p_property_id)
    ORDER BY coalesce(p.name, 'Property')
  LOOP
    v_property_count := v_property_count + 1;
    BEGIN
      v_stmt := public.get_property_monthly_statement(v_prop.id, p_year, p_month, TRUE);
    EXCEPTION
      WHEN OTHERS THEN
        v_warnings := array_append(v_warnings, v_prop.name || ': ' || SQLERRM);
        CONTINUE;
    END;

    IF v_stmt ? 'warnings' THEN
      SELECT coalesce(array_agg(w), ARRAY[]::text[])
      INTO v_warnings
      FROM (
        SELECT unnest(v_warnings) AS w
        UNION ALL
        SELECT v_prop.name || ': ' || trim(w)
        FROM jsonb_array_elements_text(coalesce(v_stmt -> 'warnings', '[]'::jsonb)) AS w
        WHERE
          trim(w) <> ''
          AND w !~* 'materializeDueRecurringExpenses|applyDepositGrowthForCurrentPropertyLeases|Express statement may differ'
      ) s;
    END IF;

    v_summary := coalesce(v_stmt -> 'summary', '{}'::jsonb);
    v_received := v_received + coalesce((v_summary ->> 'receivedThisMonth')::double precision, 0);
    v_expected := v_expected + coalesce((v_summary ->> 'expectedThisMonth')::double precision, 0);
    v_expenses := v_expenses + coalesce((v_summary ->> 'expensesThisMonth')::double precision, 0);
    v_bond := v_bond + coalesce((v_summary ->> 'bondThisMonth')::double precision, 0);
    v_net := v_net + coalesce((v_summary ->> 'netCashFlow')::double precision, 0);

    FOR v_row IN
      SELECT value
      FROM jsonb_array_elements(coalesce(v_stmt -> 'statementRows', '[]'::jsonb))
    LOOP
      v_elem := v_row
        || jsonb_build_object(
          'id',
          v_prop.id::text || ':' || coalesce(v_row ->> 'id', ''),
          'propertyId',
          v_prop.id::text,
          'propertyName',
          v_prop.name
        );
      v_all_rows := v_all_rows || jsonb_build_array(v_elem);

      -- YTD totals (calendar year to today, same rules as frontend computeYtdTotals)
      v_date := (v_row ->> 'date')::date;
      IF v_date IS NOT NULL AND v_date >= v_ytd_start AND v_date <= v_today THEN
        IF v_ytd_latest IS NULL OR v_date > v_ytd_latest THEN
          v_ytd_latest := v_date;
        END IF;
        v_src := coalesce(v_row ->> 'source', '');
        v_st := coalesce(v_row ->> 'status', '');
        v_credit := coalesce((v_row ->> 'credit')::double precision, 0);
        v_debit := coalesce((v_row ->> 'debit')::double precision, 0);
        IF v_src = 'INCOME' AND v_st = 'RECEIVED' AND v_credit > 0 THEN
          v_ytd_revenue := v_ytd_revenue + v_credit;
        ELSIF v_src = 'INVOICE' AND v_st = 'PAID' AND v_credit > 0 THEN
          v_ytd_revenue := v_ytd_revenue + v_credit;
        ELSIF v_src = 'EXPENSE' AND v_st = 'ACTIVE' AND v_debit > 0 THEN
          v_ytd_expenses := v_ytd_expenses + v_debit;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Filter merged rows
  SELECT coalesce(jsonb_agg(r ORDER BY (r ->> 'date') DESC, (r ->> 'propertyName'), (r ->> 'id')), '[]'::jsonb)
  INTO v_filtered
  FROM (
    SELECT r
    FROM jsonb_array_elements(v_all_rows) AS r
    WHERE
      (
        v_search IS NULL
        OR concat_ws(
          ' ',
          r ->> 'description',
          r ->> 'type',
          r ->> 'propertyName',
          r ->> 'source',
          r ->> 'status'
        ) ILIKE '%' || v_search || '%'
      )
      AND (
        v_source IS NULL
        OR upper(v_source) = 'ALL'
        OR r ->> 'source' = v_source
      )
  ) f;

  v_total_count := jsonb_array_length(v_filtered);

  SELECT coalesce(jsonb_agg(r), '[]'::jsonb)
  INTO v_page
  FROM (
    SELECT r
    FROM jsonb_array_elements(v_filtered) AS r
    OFFSET p_offset
    LIMIT p_limit
  ) p;

  RETURN jsonb_build_object(
    'items',
    v_page,
    'totalCount',
    v_total_count,
    'metrics',
    jsonb_build_object(
      'receivedThisMonth',
      round(v_received::numeric, 2),
      'expectedThisMonth',
      round(v_expected::numeric, 2),
      'expensesThisMonth',
      round(v_expenses::numeric, 2),
      'bondThisMonth',
      round(v_bond::numeric, 2),
      'netCashFlow',
      round(v_net::numeric, 2),
      'propertyCount',
      v_property_count
    ),
    'properties',
    v_properties,
    'warnings',
    to_jsonb(v_warnings),
    'ytd',
    jsonb_build_object(
      'year',
      extract(year FROM v_today)::integer,
      'revenue',
      round(v_ytd_revenue::numeric, 2),
      'expenses',
      round(v_ytd_expenses::numeric, 2),
      'net',
      round((v_ytd_revenue - v_ytd_expenses)::numeric, 2),
      'latestDate',
      coalesce(v_ytd_latest::text, v_today::text)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_workspace_financials_directory (integer, integer, uuid, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_financials_directory (integer, integer, uuid, integer, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_workspace_financials_directory (integer, integer, uuid, integer, integer, text, text) IS
  'Portfolio financials directory: batch statement summaries + paginated ledger rows for workspace Financials page.';
