-- Portfolio dashboard JSON for SPA (auth.uid(), RLS-safe).
-- Numeric KPIs mirror Express GET /properties/dashboard-summary (ownedPropertiesRoutes.ts)
-- except documented in docs/MIGRATION_STATUS.md (IRR deferred, no recurring materialisation, TZ).

CREATE OR REPLACE FUNCTION public.get_dashboard_summary (
  p_month text DEFAULT NULL,
  p_property_types text[] DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_portfolio_irr_horizon_years integer DEFAULT NULL,
  p_iana_timezone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid ();
  v_tz text := coalesce (nullif (trim (p_iana_timezone), ''), 'UTC');
  v_ref date;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_twelve_start timestamptz;
  v_twelve_end timestamptz;
  v_last5_start timestamptz;
  v_last5_end timestamptz;
  v_prop_ids uuid[];
  v_now_month_start date;
  v_growth_rental double precision := 6;
  v_growth_exp double precision := 6;
  v_str_net double precision := 0;
  v_ledger_received_m double precision := 0;
  v_invoice_m double precision := 0;
  v_income_received_total double precision := 0;
  v_income_expected_m double precision := 0;
  v_op_ex_m double precision := 0;
  v_debt_m double precision := 0;
  v_annual_inc12 double precision := 0;
  v_annual_opex12 double precision := 0;
  v_income_prod_val double precision := 0;
  v_total_props int := 0;
  v_total_purchase double precision := 0;
  v_total_value double precision := 0;
  v_total_bond double precision := 0;
  v_portfolio_equity double precision := 0;
  v_missing_val int := 0;
  v_missing_bond int := 0;
  v_missing_pp int := 0;
  v_land int := 0;
  v_str_count int := 0;
  v_tenant_req int := 0;
  v_occupied int := 0;
  v_vacant int := 0;
  v_leases_mtm int := 0;
  v_leases_exp int := 0;
  v_leases_fixed int := 0;
  v_leases_cancelled int := 0;
  v_missing_docs int := 0;
  v_missing_exp int := 0;
  v_deposits double precision := 0;
  v_rent_roll double precision := 0;
  v_str_rev_sum double precision := 0;
  v_contractual_rent double precision := 0;
  v_rent_overdue int := 0;
  v_rent_soon int := 0;
  v_total_cash_inv double precision := 0;
  v_est_inv_n int := 0;
  v_miss_inv_n int := 0;
  v_monthly_noi double precision;
  v_monthly_exp_tot double precision;
  v_monthly_net_cf double precision;
  v_annual_noi double precision;
  v_avg_cap double precision;
  v_oer double precision;
  v_annual_pre_tax_cf double precision;
  v_coc double precision;
  v_coc_class text;
  v_kpi_stat text;
  v_warn text[] := ARRAY[]::text[];
  v_props_by_type jsonb;
  v_charts jsonb;
  v_kpis jsonb;
  v_filters jsonb;
  v_root jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_warn := array_append (v_warn, 'Supabase get_dashboard_summary does not run materializeDueRecurringExpensesForProperties; totals may trail Express until recurring rows are materialised.');

  IF p_portfolio_irr_horizon_years IS NOT NULL THEN
    v_warn := array_append (v_warn, 'portfolioIrrHorizonYears is ignored until IRR is ported from Express.');
  END IF;

  v_warn := array_append (v_warn, 'Portfolio IRR and portfolioAnalysisOverTime are not computed in this RPC (defer to Express or a server function).');

  IF p_month IS NOT NULL AND p_month ~ '^\d{4}-\d{2}$' THEN
    v_ref := to_date (p_month || '-01', 'YYYY-MM-DD');
  ELSE
    v_ref := (date_trunc ('month', (timezone (v_tz, now ()))::date::timestamp))::date;
  END IF;

  v_month_start := (v_ref::timestamp AT TIME ZONE v_tz);
  v_month_end := ((v_ref + interval '1 month')::timestamp AT TIME ZONE v_tz);

  v_now_month_start := (date_trunc ('month', (timezone (v_tz, now ()))::date::timestamp))::date;
  v_twelve_start := (v_now_month_start::timestamp AT TIME ZONE v_tz) - interval '11 months';
  v_twelve_end := ((v_now_month_start + interval '1 month')::timestamp AT TIME ZONE v_tz);
  v_last5_start := (v_now_month_start::timestamp AT TIME ZONE v_tz) - interval '4 months';
  v_last5_end := v_twelve_end;

  SELECT
    coalesce (array_agg (pr.id), ARRAY[]::uuid[]) INTO v_prop_ids
  FROM public.properties pr
  WHERE
    pr.user_id = v_uid
    AND (p_property_id IS NULL OR pr.id = p_property_id)
    AND (
      p_property_types IS NULL
      OR cardinality (p_property_types) = 0
      OR pr.investment_type::text = ANY (p_property_types)
    );

  SELECT
    coalesce (rental_income_growth_percent_annual, 6),
    coalesce (total_expenses_growth_percent_annual, 6)
  INTO v_growth_rental, v_growth_exp
  FROM public.portfolio_projection_defaults
  LIMIT 1;

  IF cardinality (v_prop_ids) = 0 THEN
    v_props_by_type := '{}'::jsonb;
    v_total_props := 0;
  ELSE
    SELECT
      count(*)::int,
      coalesce (sum (CASE WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN purchase_price ELSE 0 END), 0),
      coalesce (sum (CASE WHEN current_estimated_value IS NOT NULL THEN current_estimated_value ELSE 0 END), 0),
      coalesce (sum (CASE WHEN outstanding_bond_balance IS NOT NULL THEN outstanding_bond_balance ELSE 0 END), 0),
      coalesce (
        sum (
          CASE
            WHEN current_estimated_value IS NOT NULL AND outstanding_bond_balance IS NOT NULL THEN current_estimated_value - outstanding_bond_balance
            ELSE 0
          END
        ),
        0
      ),
      count(*) FILTER (
        WHERE
          current_estimated_value IS NULL
      ),
      count(*) FILTER (
        WHERE
          outstanding_bond_balance IS NULL
      ),
      count(*) FILTER (
        WHERE
          purchase_price IS NULL
          OR purchase_price <= 0
      ),
      count(*) FILTER (
        WHERE
          investment_type = 'VACANT_LAND'
      ),
      count(*) FILTER (
        WHERE
          investment_type = 'SHORT_TERM_RENTAL'
      ),
      coalesce (
        (
          SELECT
            jsonb_object_agg (investment_type::text, c)
          FROM (
            SELECT
              investment_type::text,
              count(*)::int AS c
            FROM public.properties
            WHERE
              id = ANY (v_prop_ids)
            GROUP BY
              investment_type
          ) s
        ),
        '{}'::jsonb
      )
    INTO v_total_props, v_total_purchase, v_total_value, v_total_bond, v_portfolio_equity, v_missing_val, v_missing_bond, v_missing_pp, v_land, v_str_count, v_props_by_type
    FROM public.properties
    WHERE
      id = ANY (v_prop_ids);
  END IF;

  IF cardinality (v_prop_ids) = 0 THEN
    v_charts := jsonb_build_object (
      'valueDebtEquity',
      jsonb_build_object (
        'totalCurrentEstimatedValue',
        0,
        'totalOutstandingBondBalance',
        0,
        'portfolioEquity',
        0
      ),
      'monthlyIncomeExpenses',
      '[]'::jsonb,
      'expenseBreakdown',
      '[]'::jsonb,
      'propertyTypeAllocation',
      '[]'::jsonb,
      'cashFlowByProperty',
      '[]'::jsonb,
      'equityByProperty',
      '[]'::jsonb,
      'leaseTimeline',
      '[]'::jsonb,
      'shortTermRentalPerformance',
      '[]'::jsonb,
      'vacantLandHoldingCosts',
      '[]'::jsonb,
      'monthlyNOITrend',
      '[]'::jsonb,
      'incomeExpenseComposition',
      '[]'::jsonb
    );

    v_kpis := jsonb_build_object (
      'monthlyNOI',
      jsonb_build_object (
        'value',
        0,
        'status',
        'positive',
        'operatingIncome',
        0,
        'operatingIncomeActualReceived',
        0,
        'operatingIncomeExpectedFromLedger',
        0,
        'contractualMonthlyRentFromLeases',
        0,
        'operatingIncomeProjectedFromLeases',
        0,
        'operatingExpenses',
        0,
        'explanation',
        'Income less operating expenses, before debt service. Headline income is received ledger entries plus STR field estimates — not contractual lease rent unless recorded as received.'
      ),
      'monthlyExpenses',
      jsonb_build_object (
        'value',
        0,
        'operatingExpenses',
        0,
        'debtService',
        0,
        'explanation',
        'Operating costs plus bond repayments.'
      ),
      'trueCashOnCashROI',
      jsonb_build_object (
        'valuePercent',
        NULL,
        'annualPreTaxCashFlow',
        0,
        'totalCashInvested',
        NULL,
        'classification',
        'Insufficient data',
        'explanation',
        'Annual pre-tax cash flow divided by actual cash invested.'
      ),
      'portfolioIRR',
      jsonb_build_object (
        'valuePercent',
        NULL,
        'cashFlows',
        '[]'::jsonb,
        'holdingPeriodYears',
        NULL,
        'projectionGrowth',
        jsonb_build_object (
          'rentalIncomeGrowthPercentAnnual',
          v_growth_rental,
          'totalExpensesGrowthPercentAnnual',
          v_growth_exp
        ),
        'assumptions',
        ARRAY['IRR not calculated in Supabase RPC.']::text[],
        'canCalculate',
        FALSE,
        'diagnostics',
        jsonb_build_object (
          'statusCode',
          'DEFERRED',
          'statusMessage',
          'IRR not calculated in Supabase RPC.',
          'filteredPropertyCount',
          0,
          'eligiblePropertyCount',
          0,
          'irrSolveAttempted',
          FALSE,
          'irrRatePercent',
          NULL,
          'cf0',
          NULL,
          'yearlyCashFlows',
          '[]'::jsonb,
          'sumUndiscountedCashFlows',
          NULL,
          'holdingHorizonYears',
          NULL,
          'propertyInputs',
          '[]'::jsonb
        ),
        'explanation',
        'Deferred in SQL migration phase.'
      ),
      'portfolioAnalysisOverTime',
      jsonb_build_object (
        'projectionGrowth',
        jsonb_build_object (
          'rentalIncomeGrowthPercentAnnual',
          v_growth_rental,
          'totalExpensesGrowthPercentAnnual',
          v_growth_exp
        ),
        'appreciationDefaultPercent',
        5,
        'columns',
        '[]'::jsonb,
        'bondHorizonCapYears',
        NULL,
        'analysisLimitedByBondSchedule',
        FALSE,
        'explanation',
        'Deferred in SQL migration phase alongside portfolio IRR.'
      ),
      'totalProperties',
      jsonb_build_object (
        'value',
        0,
        'breakdown',
        jsonb_build_object (
          'occupied',
          0,
          'vacant',
          0,
          'land',
          0,
          'shortTerm',
          0
        )
      )
    );

    v_filters := jsonb_build_object (
      'propertyTypes',
      coalesce (to_jsonb (p_property_types), 'null'::jsonb),
      'propertyId',
      CASE
        WHEN p_property_id IS NULL THEN NULL
        ELSE to_jsonb (p_property_id::text)
      END,
      'month',
      to_jsonb (p_month),
      'portfolioIrrHorizonYears',
      to_jsonb (p_portfolio_irr_horizon_years),
      'ianaTimezone',
      to_jsonb (v_tz)
    );

    RETURN jsonb_build_object (
      'filters',
      v_filters,
      'kpis',
      v_kpis,
      'charts',
      jsonb_build_object (
        'monthlyNOITrend',
        v_charts -> 'monthlyNOITrend',
        'incomeExpenseComposition',
        v_charts -> 'incomeExpenseComposition'
      ),
      'warnings',
      to_jsonb (v_warn),
      'totalProperties',
      0,
      'propertiesByType',
      '{}'::jsonb,
      'tenantRequiredProperties',
      0,
      'occupiedProperties',
      0,
      'vacantRentalProperties',
      0,
      'landProperties',
      0,
      'shortTermRentalProperties',
      0,
      'occupancyRate',
      0,
      'totalCurrentEstimatedValue',
      0,
      'totalOutstandingBondBalance',
      0,
      'portfolioEquity',
      0,
      'totalPurchasePrice',
      0,
      'monthlyRentRoll',
      0,
      'monthlyShortTermRentalRevenue',
      0,
      'totalMonthlyIncome',
      0,
      'totalMonthlyIncomeReceived',
      0,
      'totalMonthlyIncomeExpectedLedger',
      0,
      'contractualMonthlyRentFromLeases',
      0,
      'totalMonthlyOperatingExpenses',
      0,
      'totalMonthlyDebtService',
      0,
      'monthlyNetCashFlow',
      0,
      'annualNOI',
      0,
      'averageCapRate',
      0,
      'averageGrossYield',
      0,
      'averageNetYield',
      0,
      'operatingExpenseRatio',
      0,
      'depositsHeld',
      0,
      'rentDue',
      jsonb_build_object (
        'dueSoon',
        0,
        'overdue',
        0,
        'totalAttention',
        0
      ),
      'leases',
      jsonb_build_object (
        'expiringSoon',
        0,
        'monthToMonth',
        0,
        'activeFixedTerm',
        0,
        'cancelledOrTerminated',
        0
      ),
      'missingData',
      jsonb_build_object (
        'missingCurrentEstimatedValue',
        0,
        'missingOutstandingBondBalance',
        0,
        'missingPurchasePrice',
        0,
        'missingLeaseDocuments',
        0,
        'missingExpenseData',
        0
      ),
      'charts',
      v_charts
    );
  END IF;

  SELECT
    coalesce (sum (i.amount), 0) INTO v_ledger_received_m
  FROM public.income_entries i
  WHERE
    i.user_id = v_uid
    AND i.property_id = ANY (v_prop_ids)
    AND i.status = 'RECEIVED'
    AND i.income_date >= v_month_start
    AND i.income_date < v_month_end;

  SELECT
    coalesce (sum (inv.total), 0) INTO v_invoice_m
  FROM public.invoices inv
  WHERE
    inv.user_id = v_uid
    AND inv.property_id = ANY (v_prop_ids)
    AND inv.status = 'PAID'
    AND inv.invoice_date >= v_month_start
    AND inv.invoice_date < v_month_end;

  v_income_received_total := v_ledger_received_m + v_invoice_m;

  SELECT
    coalesce (sum (i.amount), 0) INTO v_income_expected_m
  FROM public.income_entries i
  WHERE
    i.user_id = v_uid
    AND i.property_id = ANY (v_prop_ids)
    AND i.status = 'EXPECTED'
    AND i.income_date >= v_month_start
    AND i.income_date < v_month_end;

  SELECT
    coalesce (sum (e.amount) FILTER (WHERE e.category <> 'BOND_PAYMENT'), 0),
    coalesce (sum (e.amount) FILTER (WHERE e.category = 'BOND_PAYMENT'), 0)
  INTO v_op_ex_m, v_debt_m
  FROM public.expense_entries e
  WHERE
    e.user_id = v_uid
    AND e.property_id = ANY (v_prop_ids)
    AND e.status = 'ACTIVE'
    AND e.expense_date >= v_month_start
    AND e.expense_date < v_month_end;

  SELECT
    coalesce (sum (i.amount), 0) INTO v_annual_inc12
  FROM public.income_entries i
  WHERE
    i.user_id = v_uid
    AND i.property_id = ANY (v_prop_ids)
    AND i.status = 'RECEIVED'
    AND i.income_date >= v_twelve_start
    AND i.income_date < v_twelve_end;

  SELECT
    coalesce (sum (e.amount) FILTER (WHERE e.category <> 'BOND_PAYMENT'), 0) INTO v_annual_opex12
  FROM public.expense_entries e
  WHERE
    e.user_id = v_uid
    AND e.property_id = ANY (v_prop_ids)
    AND e.status = 'ACTIVE'
    AND e.expense_date >= v_twelve_start
    AND e.expense_date < v_twelve_end;

  SELECT
    coalesce (sum (current_estimated_value), 0) INTO v_income_prod_val
  FROM public.properties p
  WHERE
    p.id = ANY (v_prop_ids)
    AND p.current_estimated_value IS NOT NULL
    AND coalesce (p.investment_type::text, 'OTHER') NOT IN ('PRIMARY_RESIDENCE', 'VACANT_LAND', 'FLIP');

  SELECT
    coalesce (sum (l.monthly_rent), 0),
    coalesce (sum (l.deposit_amount), 0)
  INTO v_contractual_rent, v_deposits
  FROM public.leases l
  WHERE
    l.property_id = ANY (v_prop_ids)
    AND (
      CASE
        WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
        WHEN l.status = 'ACTIVE'
        AND l.fixed_term_end_date IS NOT NULL
        AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
        ELSE l.status::text
      END
    ) IN ('ACTIVE', 'MONTH_TO_MONTH');

  v_rent_roll := v_contractual_rent;

  SELECT
    coalesce (
      sum (
        CASE
          WHEN p.investment_type = 'SHORT_TERM_RENTAL' THEN (
            coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
          ) * (1 - coalesce (p.platform_fee_percent, 0) / 100.0)
          - (
            coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
          ) * (coalesce (p.management_fee_percent, 0) / 100.0)
          + coalesce (p.cleaning_fees_monthly, 0)
          ELSE 0
        END
      ),
      0
    ) INTO v_str_net
  FROM public.properties p
  WHERE
    p.id = ANY (v_prop_ids);

  v_str_rev_sum := v_str_net;

  SELECT
    count(*) FILTER (
      WHERE
        tr
    ),
    count(*) FILTER (
      WHERE
        tr
        AND (ht OR hl)
    ),
    count(*) FILTER (
      WHERE
        tr
        AND NOT ht
        AND NOT hl
    ),
    count(*) FILTER (
      WHERE
        hl
        AND ld = 'MONTH_TO_MONTH'
    ),
    count(*) FILTER (
      WHERE
        hl
        AND fend IS NOT NULL
        AND fend >= now ()
        AND fend <= now () + interval '90 days'
    ),
    count(*) FILTER (
      WHERE
        hl
        AND lt = 'FIXED_TERM'
        AND ld = 'ACTIVE'
    ),
    coalesce (sum (mdoc), 0),
    coalesce (sum (mexp), 0)
  INTO v_tenant_req, v_occupied, v_vacant, v_leases_mtm, v_leases_exp, v_leases_fixed, v_missing_docs, v_missing_exp
  FROM (
    SELECT
      p.id,
      CASE
        WHEN coalesce (p.investment_type::text, 'OTHER') IN ('VACANT_LAND', 'SHORT_TERM_RENTAL', 'FLIP', 'PRIMARY_RESIDENCE') THEN FALSE
        WHEN p.investment_type::text = 'BRRRR'
        AND coalesce (p.brrrr_stage::text, '') NOT IN ('RENTED', 'REFINANCED') THEN FALSE
        ELSE TRUE
      END AS tr,
      EXISTS (
        SELECT
          1
        FROM public.tenants t
        WHERE
          t.property_id = p.id
          AND t.status = 'ACTIVE'
      ) AS ht,
      EXISTS (
        SELECT
          1
        FROM public.leases l
        WHERE
          l.property_id = p.id
          AND (
            CASE
              WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
              WHEN l.status = 'ACTIVE'
              AND l.fixed_term_end_date IS NOT NULL
              AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
              ELSE l.status::text
            END
          ) IN ('ACTIVE', 'MONTH_TO_MONTH')
      ) AS hl,
      (
        SELECT
          (
            CASE
              WHEN l2.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l2.status::text
              WHEN l2.status = 'ACTIVE'
              AND l2.fixed_term_end_date IS NOT NULL
              AND l2.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
              ELSE l2.status::text
            END
          )
        FROM public.leases l2
        WHERE
          l2.property_id = p.id
        ORDER BY
          CASE
            WHEN (
              CASE
                WHEN l2.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l2.status::text
                WHEN l2.status = 'ACTIVE'
                AND l2.fixed_term_end_date IS NOT NULL
                AND l2.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                ELSE l2.status::text
              END
            ) IN ('ACTIVE', 'MONTH_TO_MONTH') THEN 0
            ELSE 1
          END,
          l2.start_date DESC NULLS LAST
        LIMIT
          1
      ) AS ld,
      (
        SELECT
          l2.fixed_term_end_date
        FROM public.leases l2
        WHERE
          l2.property_id = p.id
        ORDER BY
          CASE
            WHEN (
              CASE
                WHEN l2.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l2.status::text
                WHEN l2.status = 'ACTIVE'
                AND l2.fixed_term_end_date IS NOT NULL
                AND l2.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                ELSE l2.status::text
              END
            ) IN ('ACTIVE', 'MONTH_TO_MONTH') THEN 0
            ELSE 1
          END,
          l2.start_date DESC NULLS LAST
        LIMIT
          1
      ) AS fend,
      (
        SELECT
          l2.lease_type
        FROM public.leases l2
        WHERE
          l2.property_id = p.id
        ORDER BY
          CASE
            WHEN (
              CASE
                WHEN l2.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l2.status::text
                WHEN l2.status = 'ACTIVE'
                AND l2.fixed_term_end_date IS NOT NULL
                AND l2.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                ELSE l2.status::text
              END
            ) IN ('ACTIVE', 'MONTH_TO_MONTH') THEN 0
            ELSE 1
          END,
          l2.start_date DESC NULLS LAST
        LIMIT
          1
      ) AS lt,
      CASE
        WHEN EXISTS (
          SELECT
            1
          FROM public.leases l3
          WHERE
            l3.property_id = p.id
            AND (
              CASE
                WHEN l3.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l3.status::text
                WHEN l3.status = 'ACTIVE'
                AND l3.fixed_term_end_date IS NOT NULL
                AND l3.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                ELSE l3.status::text
              END
            ) IN ('ACTIVE', 'MONTH_TO_MONTH')
        )
        AND NOT EXISTS (
          SELECT
            1
          FROM public.property_documents d
          WHERE
            d.property_id = p.id
        ) THEN 1
        ELSE 0
      END AS mdoc,
      CASE
        WHEN NOT EXISTS (
          SELECT
            1
          FROM public.expense_entries e
          WHERE
            e.property_id = p.id
            AND e.user_id = v_uid
            AND e.status = 'ACTIVE'
            AND e.expense_date >= v_month_start
            AND e.expense_date < v_month_end
        )
        AND NOT EXISTS (
          SELECT
            1
          FROM public.income_entries i2
          WHERE
            i2.property_id = p.id
            AND i2.user_id = v_uid
            AND i2.income_date >= v_month_start
            AND i2.income_date < v_month_end
        ) THEN 1
        ELSE 0
      END AS mexp
    FROM public.properties p
    WHERE
      p.id = ANY (v_prop_ids)
  ) s;

  SELECT
    count(*) INTO v_leases_cancelled
  FROM public.leases l
  WHERE
    l.property_id = ANY (v_prop_ids)
    AND l.status IN ('CANCELLED', 'TERMINATED');

  WITH
  unpaid AS (
    SELECT
      inv.tenant_id,
      inv.due_date
    FROM public.invoices inv
    WHERE
      inv.user_id = v_uid
      AND inv.property_id = ANY (v_prop_ids)
      AND inv.status NOT IN ('PAID', 'CANCELLED')
  ),
  keyed AS (
    SELECT
      concat_ws (
        '-',
        tenant_id::text,
        (extract (YEAR FROM timezone (v_tz, due_date)))::int::text,
        (extract (MONTH FROM timezone (v_tz, due_date)))::int::text
      ) AS k,
      due_date
    FROM unpaid
  ),
  per_key AS (
    SELECT
      k,
      min (due_date) AS min_due
    FROM keyed
    GROUP BY
      k
  )
  SELECT
    count(*) FILTER (
      WHERE
        min_due < now ()
    ),
    count(*) FILTER (
      WHERE
        min_due >= now ()
        AND min_due <= now () + interval '7 days'
    )
  INTO v_rent_overdue, v_rent_soon
  FROM per_key;

  SELECT
    coalesce (sum (cash_line), 0),
    count(*) FILTER (
      WHERE
        used_est
    ),
    count(*) FILTER (
      WHERE
        used_miss
    )
  INTO v_total_cash_inv, v_est_inv_n, v_miss_inv_n
  FROM (
    SELECT
      CASE
        WHEN p.total_cash_invested IS NOT NULL
        AND p.total_cash_invested > 0 THEN p.total_cash_invested
        WHEN p.purchase_price IS NULL
        OR p.purchase_price <= 0 THEN NULL
        ELSE greatest (0, p.purchase_price - least (greatest (0, coalesce (p.outstanding_bond_balance, 0)), p.purchase_price))
        + coalesce (p.transfer_costs, 0)
        + coalesce (p.bond_costs, 0)
        + coalesce (p.rehab_budget, 0)
        + coalesce (p.furnishing_value, 0)
      END AS cash_line,
      CASE
        WHEN p.total_cash_invested IS NOT NULL
        AND p.total_cash_invested > 0 THEN FALSE
        WHEN p.purchase_price IS NULL
        OR p.purchase_price <= 0 THEN FALSE
        WHEN greatest (0, p.purchase_price - least (greatest (0, coalesce (p.outstanding_bond_balance, 0)), p.purchase_price))
        + coalesce (p.transfer_costs, 0)
        + coalesce (p.bond_costs, 0)
        + coalesce (p.rehab_budget, 0)
        + coalesce (p.furnishing_value, 0) > 0 THEN TRUE
        ELSE FALSE
      END AS used_est,
      CASE
        WHEN p.total_cash_invested IS NOT NULL
        AND p.total_cash_invested > 0 THEN FALSE
        WHEN p.purchase_price IS NULL
        OR p.purchase_price <= 0 THEN TRUE
        WHEN greatest (0, p.purchase_price - least (greatest (0, coalesce (p.outstanding_bond_balance, 0)), p.purchase_price))
        + coalesce (p.transfer_costs, 0)
        + coalesce (p.bond_costs, 0)
        + coalesce (p.rehab_budget, 0)
        + coalesce (p.furnishing_value, 0) > 0 THEN FALSE
        ELSE TRUE
      END AS used_miss
    FROM public.properties p
    WHERE
      p.id = ANY (v_prop_ids)
  ) cash_rows;

  v_monthly_noi := v_income_received_total + v_str_net - v_op_ex_m;
  v_monthly_exp_tot := v_op_ex_m + v_debt_m;
  v_monthly_net_cf := v_income_received_total + v_str_net - v_op_ex_m - v_debt_m;
  v_annual_noi := v_annual_inc12 - v_annual_opex12;
  v_avg_cap := CASE
    WHEN v_income_prod_val > 0 THEN v_annual_noi / v_income_prod_val
    ELSE 0
  END;
  v_oer := CASE
    WHEN v_annual_inc12 > 0 THEN v_annual_opex12 / v_annual_inc12
    ELSE 0
  END;
  v_annual_pre_tax_cf := v_monthly_noi * 12 - v_debt_m * 12;

  IF v_total_cash_inv > 0 THEN
    v_coc := v_annual_pre_tax_cf / v_total_cash_inv;
  ELSE
    v_coc := NULL;
  END IF;

  v_coc_class := CASE
    WHEN v_coc IS NULL THEN 'Insufficient data'
    WHEN v_coc < 0 THEN 'Deficit'
    WHEN v_coc < 0.05 THEN 'Weak'
    WHEN v_coc < 0.08 THEN 'Acceptable'
    WHEN v_coc < 0.12 THEN 'Strong'
    ELSE 'Very strong, check assumptions'
  END;

  v_kpi_stat := CASE
    WHEN v_monthly_noi < 0 THEN 'negative'
    ELSE 'positive'
  END;

  IF v_contractual_rent > 0
  AND v_income_received_total = 0 THEN
    v_warn := array_append (v_warn, 'Headline monthly income uses received ledger entries (plus STR estimates). Contractual rent from leases is reported separately until rent is recorded as received.');
  END IF;

  IF v_miss_inv_n > 0 THEN
    v_warn := array_append (v_warn, format ('Missing cash invested for %s properties', v_miss_inv_n));
  END IF;

  IF v_est_inv_n > 0 THEN
    v_warn := array_append (v_warn, format ('Estimated cash invested for %s properties using purchase price − bond + (transfer + bond + renovation + furnishing costs where available). Add “Total cash invested” for exact ROI/IRR.', v_est_inv_n));
  END IF;

  SELECT
    jsonb_build_object (
      'valueDebtEquity',
      jsonb_build_object (
        'totalCurrentEstimatedValue',
        v_total_value,
        'totalOutstandingBondBalance',
        v_total_bond,
        'portfolioEquity',
        v_portfolio_equity
      ),
      'monthlyIncomeExpenses',
      coalesce (mie, '[]'::jsonb),
      'expenseBreakdown',
      coalesce (eb, '[]'::jsonb),
      'propertyTypeAllocation',
      coalesce (pta, '[]'::jsonb),
      'cashFlowByProperty',
      coalesce (cfb, '[]'::jsonb),
      'equityByProperty',
      coalesce (eqb, '[]'::jsonb),
      'leaseTimeline',
      coalesce (ltl, '[]'::jsonb),
      'shortTermRentalPerformance',
      coalesce (strp, '[]'::jsonb),
      'vacantLandHoldingCosts',
      coalesce (vlc, '[]'::jsonb),
      'monthlyNOITrend',
      coalesce (noit, '[]'::jsonb),
      'incomeExpenseComposition',
      coalesce (iec, '[]'::jsonb)
    )
  INTO v_charts
  FROM (
    SELECT
      (
        SELECT
          jsonb_agg (
            jsonb_build_object (
              'month',
              ym,
              'income',
              inc,
              'operatingExpenses',
              opex,
              'debtService',
              debt,
              'netCashFlow',
              inc - opex - debt
            )
            ORDER BY
              ym
          )
        FROM (
          SELECT
            to_char (gs, 'YYYY-MM') AS ym,
            coalesce (ib.t, 0) AS inc,
            coalesce (ob.t, 0) AS opex,
            coalesce (db.t, 0) AS debt
          FROM generate_series (v_twelve_start, v_twelve_end - interval '1 day', interval '1 month') AS gs
            LEFT JOIN (
              SELECT
                to_char (timezone (v_tz, i.income_date), 'YYYY-MM') AS ym,
                sum (i.amount) AS t
              FROM public.income_entries i
              WHERE
                i.user_id = v_uid
                AND i.property_id = ANY (v_prop_ids)
                AND i.status = 'RECEIVED'
                AND i.income_date >= v_twelve_start
                AND i.income_date < v_twelve_end
              GROUP BY
                1
            ) ib ON ib.ym = to_char (gs, 'YYYY-MM')
            LEFT JOIN (
              SELECT
                to_char (timezone (v_tz, e.expense_date), 'YYYY-MM') AS ym,
                sum (e.amount) AS t
              FROM public.expense_entries e
              WHERE
                e.user_id = v_uid
                AND e.property_id = ANY (v_prop_ids)
                AND e.status = 'ACTIVE'
                AND e.category <> 'BOND_PAYMENT'
                AND e.expense_date >= v_twelve_start
                AND e.expense_date < v_twelve_end
              GROUP BY
                1
            ) ob ON ob.ym = to_char (gs, 'YYYY-MM')
            LEFT JOIN (
              SELECT
                to_char (timezone (v_tz, e.expense_date), 'YYYY-MM') AS ym,
                sum (e.amount) AS t
              FROM public.expense_entries e
              WHERE
                e.user_id = v_uid
                AND e.property_id = ANY (v_prop_ids)
                AND e.status = 'ACTIVE'
                AND e.category = 'BOND_PAYMENT'
                AND e.expense_date >= v_twelve_start
                AND e.expense_date < v_twelve_end
              GROUP BY
                1
            ) db ON db.ym = to_char (gs, 'YYYY-MM')
        ) q
      ) AS mie,
      (
        SELECT
          jsonb_agg (jsonb_build_object ('category', category::text, 'amount', amt) ORDER BY category::text)
        FROM (
          SELECT
            e.category,
            sum (e.amount) AS amt
          FROM public.expense_entries e
          WHERE
            e.user_id = v_uid
            AND e.property_id = ANY (v_prop_ids)
            AND e.status = 'ACTIVE'
            AND e.expense_date >= v_month_start
            AND e.expense_date < v_month_end
          GROUP BY
            e.category
        ) x
      ) AS eb,
      (
        SELECT
          jsonb_agg (
            jsonb_build_object (
              'type',
              investment_type::text,
              'typeLabel',
              CASE investment_type::text
                WHEN 'LONG_TERM_RENTAL' THEN 'Long-Term Rental'
                WHEN 'SHORT_TERM_RENTAL' THEN 'Short-Term Rental'
                WHEN 'PRIMARY_RESIDENCE' THEN 'Primary Residence'
                WHEN 'HOUSE_HACK' THEN 'House Hack'
                WHEN 'BRRRR' THEN 'BRRRR'
                WHEN 'FLIP' THEN 'Flip'
                WHEN 'VACANT_LAND' THEN 'Vacant Land'
                WHEN 'COMMERCIAL' THEN 'Commercial'
                WHEN 'MIXED_USE' THEN 'Mixed Use'
                ELSE 'Other'
              END,
              'count',
              c
            )
            ORDER BY
              investment_type::text
          )
        FROM (
          SELECT
            investment_type,
            count(*)::int AS c
          FROM public.properties
          WHERE
            id = ANY (v_prop_ids)
          GROUP BY
            investment_type
        ) t
      ) AS pta,
      (
        SELECT
          jsonb_agg (row_json ORDER BY (row_json ->> 'netCashFlow')::double precision DESC NULLS LAST)
        FROM (
          SELECT
            jsonb_build_object (
              'propertyId',
              p.id::text,
              'propertyName',
              p.name,
              'name',
              p.name,
              'netCashFlow',
              coalesce (inc.t, 0) + coalesce (inv.t, 0) - coalesce (op.t, 0) - coalesce (bd.t, 0),
              'monthlyIncome',
              coalesce (inc.t, 0) + coalesce (inv.t, 0),
              'monthlyExpenses',
              coalesce (op.t, 0) + coalesce (bd.t, 0)
            ) AS row_json
          FROM public.properties p
            LEFT JOIN (
              SELECT
                property_id,
                sum (amount) AS t
              FROM public.income_entries i
              WHERE
                i.user_id = v_uid
                AND i.status = 'RECEIVED'
                AND i.income_date >= v_month_start
                AND i.income_date < v_month_end
              GROUP BY
                1
            ) inc ON inc.property_id = p.id
            LEFT JOIN (
              SELECT
                property_id,
                sum (total) AS t
              FROM public.invoices inv
              WHERE
                inv.user_id = v_uid
                AND inv.status = 'PAID'
                AND inv.invoice_date >= v_month_start
                AND inv.invoice_date < v_month_end
              GROUP BY
                1
            ) inv ON inv.property_id = p.id
            LEFT JOIN (
              SELECT
                property_id,
                sum (amount) AS t
              FROM public.expense_entries e
              WHERE
                e.user_id = v_uid
                AND e.status = 'ACTIVE'
                AND e.category <> 'BOND_PAYMENT'
                AND e.expense_date >= v_month_start
                AND e.expense_date < v_month_end
              GROUP BY
                1
            ) op ON op.property_id = p.id
            LEFT JOIN (
              SELECT
                property_id,
                sum (amount) AS t
              FROM public.expense_entries e
              WHERE
                e.user_id = v_uid
                AND e.status = 'ACTIVE'
                AND e.category = 'BOND_PAYMENT'
                AND e.expense_date >= v_month_start
                AND e.expense_date < v_month_end
              GROUP BY
                1
            ) bd ON bd.property_id = p.id
          WHERE
            p.id = ANY (v_prop_ids)
        ) z
      ) AS cfb,
      (
        SELECT
          jsonb_agg (
            row_json
            ORDER BY
              coalesce ((row_json ->> 'equity')::double precision, '-infinity'::double precision) DESC
          )
        FROM (
          SELECT
            jsonb_build_object (
              'propertyId',
              p.id::text,
              'propertyName',
              p.name,
              'equity',
              CASE
                WHEN p.current_estimated_value IS NOT NULL
                AND p.outstanding_bond_balance IS NOT NULL THEN p.current_estimated_value - p.outstanding_bond_balance
                ELSE NULL
              END
            ) AS row_json
          FROM public.properties p
          WHERE
            p.id = ANY (v_prop_ids)
        ) z
      ) AS eqb,
      (
        SELECT
          jsonb_agg (
            row_json
            ORDER BY
              coalesce ((row_json ->> 'fixedTermEndDate')::timestamptz, 'infinity'::timestamptz) ASC
          )
        FROM (
          SELECT
            jsonb_build_object (
              'propertyId',
              p.id::text,
              'propertyName',
              p.name,
              'tenantName',
              CASE
                WHEN t.id IS NOT NULL THEN concat_ws (' ', t.first_name, t.last_name)
                ELSE NULL
              END,
              'fixedTermEndDate',
              cl.fixed_term_end_date,
              'displayStatus',
              cl.disp
            ) AS row_json
          FROM public.properties p
            INNER JOIN (
              SELECT DISTINCT ON (l.property_id)
                l.property_id,
                l.fixed_term_end_date,
                l.tenant_id,
                (
                  CASE
                    WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
                    WHEN l.status = 'ACTIVE'
                    AND l.fixed_term_end_date IS NOT NULL
                    AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                    ELSE l.status::text
                  END
                ) AS disp
              FROM public.leases l
              WHERE
                l.property_id = ANY (v_prop_ids)
                AND (
                  CASE
                    WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
                    WHEN l.status = 'ACTIVE'
                    AND l.fixed_term_end_date IS NOT NULL
                    AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                    ELSE l.status::text
                  END
                ) IN ('ACTIVE', 'MONTH_TO_MONTH')
              ORDER BY
                l.property_id,
                l.start_date DESC NULLS LAST
            ) cl ON cl.property_id = p.id
            LEFT JOIN public.tenants t ON t.id = cl.tenant_id
          WHERE
            p.id = ANY (v_prop_ids)
        ) z
      ) AS ltl,
      (
        SELECT
          jsonb_agg (row_json)
        FROM (
          SELECT
            jsonb_build_object (
              'propertyId',
              p.id::text,
              'propertyName',
              p.name,
              'adr',
              coalesce (p.average_daily_rate, 0),
              'occupancyRate',
              coalesce (p.occupancy_rate, 0),
              'availableNightsPerMonth',
              coalesce (p.available_nights_per_month, 0),
              'grossRevenue',
              coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0),
              'netRevenue',
              (
                coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
              ) * (1 - coalesce (p.platform_fee_percent, 0) / 100.0)
              - (
                coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
              ) * (coalesce (p.management_fee_percent, 0) / 100.0)
              + coalesce (p.cleaning_fees_monthly, 0),
              'revpar',
              CASE
                WHEN coalesce (p.available_nights_per_month, 0) > 0 THEN (
                  coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
                ) / p.available_nights_per_month
                ELSE 0
              END
            ) AS row_json
          FROM public.properties p
          WHERE
            p.id = ANY (v_prop_ids)
            AND p.investment_type = 'SHORT_TERM_RENTAL'
        ) z
      ) AS strp,
      (
        SELECT
          jsonb_agg (row_json)
        FROM (
          SELECT
            jsonb_build_object (
              'propertyId',
              p.id::text,
              'propertyName',
              p.name,
              'holdingCostsMonthly',
              coalesce (op.t, 0)
            ) AS row_json
          FROM public.properties p
            LEFT JOIN (
              SELECT
                property_id,
                sum (amount) AS t
              FROM public.expense_entries e
              WHERE
                e.user_id = v_uid
                AND e.status = 'ACTIVE'
                AND e.category <> 'BOND_PAYMENT'
                AND e.expense_date >= v_month_start
                AND e.expense_date < v_month_end
              GROUP BY
                1
            ) op ON op.property_id = p.id
          WHERE
            p.id = ANY (v_prop_ids)
            AND p.investment_type = 'VACANT_LAND'
        ) z
      ) AS vlc,
      (
        WITH
        income5m AS (
          SELECT
            ym,
            sum (t) AS t
          FROM (
            SELECT
              to_char (timezone (v_tz, i.income_date), 'YYYY-MM') AS ym,
              sum (i.amount) AS t
            FROM public.income_entries i
            WHERE
              i.user_id = v_uid
              AND i.property_id = ANY (v_prop_ids)
              AND i.status = 'RECEIVED'
              AND i.income_date >= v_last5_start
              AND i.income_date < v_last5_end
            GROUP BY
              1
            UNION ALL
            SELECT
              to_char (timezone (v_tz, inv.invoice_date), 'YYYY-MM') AS ym,
              sum (inv.total) AS t
            FROM public.invoices inv
            WHERE
              inv.user_id = v_uid
              AND inv.property_id = ANY (v_prop_ids)
              AND inv.status = 'PAID'
              AND inv.invoice_date >= v_last5_start
              AND inv.invoice_date < v_last5_end
            GROUP BY
              1
          ) u
          GROUP BY
            ym
        ),
        opex5 AS (
          SELECT
            to_char (timezone (v_tz, e.expense_date), 'YYYY-MM') AS ym,
            sum (e.amount) AS t
          FROM public.expense_entries e
          WHERE
            e.user_id = v_uid
            AND e.property_id = ANY (v_prop_ids)
            AND e.status = 'ACTIVE'
            AND e.category <> 'BOND_PAYMENT'
            AND e.expense_date >= v_last5_start
            AND e.expense_date < v_last5_end
          GROUP BY
            1
        ),
        lease_est AS (
          SELECT
            coalesce (sum (l.monthly_rent), 0) AS mrent
          FROM public.leases l
          WHERE
            l.property_id = ANY (v_prop_ids)
            AND (
              CASE
                WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
                WHEN l.status = 'ACTIVE'
                AND l.fixed_term_end_date IS NOT NULL
                AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
                ELSE l.status::text
              END
            ) IN ('ACTIVE', 'MONTH_TO_MONTH')
        ),
        avg_op AS (
          SELECT
            coalesce (avg (t), 0) AS a
          FROM opex5
        )
        SELECT
          jsonb_agg (
            jsonb_build_object (
              'month',
              bucket,
              'label',
              to_char (to_date (concat (bucket, '-01'), 'YYYY-MM-DD'), 'Mon'),
              'income',
              inc,
              'operatingExpenses',
              opex_use,
              'noi',
              inc - opex_use,
              'estimatedIncome',
              est_inc,
              'estimatedExpenses',
              est_exp
            )
            ORDER BY
              bucket
          )
        FROM (
          SELECT
            to_char (gs, 'YYYY-MM') AS bucket,
            CASE
              WHEN coalesce (i5.t, 0) = 0 THEN (SELECT mrent FROM lease_est) + v_str_net
              ELSE coalesce (i5.t, 0)
            END AS inc,
            CASE
              WHEN o5.t IS NULL THEN (SELECT a FROM avg_op)
              ELSE o5.t
            END AS opex_use,
            CASE
              WHEN coalesce (i5.t, 0) = 0 THEN TRUE
              ELSE FALSE
            END AS est_inc,
            CASE
              WHEN o5.t IS NULL THEN TRUE
              ELSE FALSE
            END AS est_exp
          FROM generate_series (v_last5_start, v_last5_end - interval '1 day', interval '1 month') AS gs
            LEFT JOIN income5m i5 ON i5.ym = to_char (gs, 'YYYY-MM')
            LEFT JOIN opex5 o5 ON o5.ym = to_char (gs, 'YYYY-MM')
        ) q
      ) AS noit,
      (
        SELECT
          coalesce (jsonb_agg (elem), '[]'::jsonb)
        FROM (
          SELECT
            jsonb_build_object ('category', cat, 'type', typ, 'amount', amt) AS elem
          FROM (
            SELECT
              'Rental Income' AS cat,
              'income'::text AS typ,
              coalesce (sum (i.amount), 0) AS amt
            FROM public.income_entries i
            WHERE
              i.user_id = v_uid
              AND i.property_id = ANY (v_prop_ids)
              AND i.status = 'RECEIVED'
              AND i.category = 'RENT'
              AND i.income_date >= v_month_start
              AND i.income_date < v_month_end
            UNION ALL
            SELECT
              'Utility Recoveries',
              'income',
              coalesce (sum (i.amount), 0)
            FROM public.income_entries i
            WHERE
              i.user_id = v_uid
              AND i.property_id = ANY (v_prop_ids)
              AND i.status = 'RECEIVED'
              AND i.category = 'UTILITIES_RECOVERY'
              AND i.income_date >= v_month_start
              AND i.income_date < v_month_end
            UNION ALL
            SELECT
              'Other Income',
              'income',
              coalesce (sum (i.amount), 0)
            FROM public.income_entries i
            WHERE
              i.user_id = v_uid
              AND i.property_id = ANY (v_prop_ids)
              AND i.status = 'RECEIVED'
              AND i.category NOT IN ('RENT', 'UTILITIES_RECOVERY')
              AND i.income_date >= v_month_start
              AND i.income_date < v_month_end
            UNION ALL
            SELECT
              'Invoice payments',
              'income',
              coalesce (sum (inv.total), 0)
            FROM public.invoices inv
            WHERE
              inv.user_id = v_uid
              AND inv.property_id = ANY (v_prop_ids)
              AND inv.status = 'PAID'
              AND inv.invoice_date >= v_month_start
              AND inv.invoice_date < v_month_end
            UNION ALL
            SELECT
              'Short-Term Rental Income',
              'income',
              v_str_net
            FROM (SELECT 1) AS _str_stub
            WHERE
              v_str_net > 0
            UNION ALL
            SELECT
              'Rates & Taxes',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'RATES_TAXES'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Water',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'WATER'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Electricity',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'ELECTRICITY'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Levies',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'LEVIES'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Insurance',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'INSURANCE'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Maintenance',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'MAINTENANCE'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Repairs',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'REPAIRS'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Management Fees',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'MANAGEMENT_FEES'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Debt Service / Bond Payments',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category = 'BOND_PAYMENT'
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
            UNION ALL
            SELECT
              'Other Expenses',
              'expense',
              coalesce (sum (e.amount), 0)
            FROM public.expense_entries e
            WHERE
              e.user_id = v_uid
              AND e.property_id = ANY (v_prop_ids)
              AND e.status = 'ACTIVE'
              AND e.category NOT IN (
                'RATES_TAXES',
                'WATER',
                'ELECTRICITY',
                'LEVIES',
                'INSURANCE',
                'MAINTENANCE',
                'REPAIRS',
                'MANAGEMENT_FEES',
                'BOND_PAYMENT'
              )
              AND e.expense_date >= v_month_start
              AND e.expense_date < v_month_end
          ) ledger_rows (cat, typ, amt)
          WHERE
            amt > 0
          UNION ALL
          SELECT
            jsonb_build_object ('category', 'Platform Fees', 'type', 'expense', 'amount', pf.amt) AS elem
          FROM (
            SELECT
              sum (
                (
                  coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
                ) * (coalesce (p.platform_fee_percent, 0) / 100.0)
              ) AS amt
            FROM public.properties p
            WHERE
              p.id = ANY (v_prop_ids)
              AND p.investment_type = 'SHORT_TERM_RENTAL'
          ) pf
          WHERE
            pf.amt > 0
          UNION ALL
          SELECT
            jsonb_build_object ('category', 'Management Fees', 'type', 'expense', 'amount', mg.amt) AS elem
          FROM (
            SELECT
              sum (
                (
                  coalesce (p.average_daily_rate, 0) * coalesce (p.occupancy_rate, 0) * coalesce (p.available_nights_per_month, 0)
                ) * (coalesce (p.management_fee_percent, 0) / 100.0)
              ) AS amt
            FROM public.properties p
            WHERE
              p.id = ANY (v_prop_ids)
              AND p.investment_type = 'SHORT_TERM_RENTAL'
          ) mg
          WHERE
            mg.amt > 0
          UNION ALL
          SELECT
            jsonb_build_object ('category', 'Cleaning', 'type', 'expense', 'amount', cln.amt) AS elem
          FROM (
            SELECT
              sum (coalesce (p.cleaning_fees_monthly, 0)) AS amt
            FROM public.properties p
            WHERE
              p.id = ANY (v_prop_ids)
              AND p.investment_type = 'SHORT_TERM_RENTAL'
          ) cln
          WHERE
            cln.amt > 0
          UNION ALL
          SELECT
            jsonb_build_object ('category', 'Utilities', 'type', 'expense', 'amount', ut.amt) AS elem
          FROM (
            SELECT
              sum (coalesce (p.monthly_utilities, 0)) AS amt
            FROM public.properties p
            WHERE
              p.id = ANY (v_prop_ids)
              AND p.investment_type = 'SHORT_TERM_RENTAL'
          ) ut
          WHERE
            ut.amt > 0
        ) comp_rows (elem)
      ) AS iec
  ) sub;

  v_filters := jsonb_build_object (
    'propertyTypes',
    coalesce (to_jsonb (p_property_types), 'null'::jsonb),
    'propertyId',
    CASE
      WHEN p_property_id IS NULL THEN NULL
      ELSE to_jsonb (p_property_id::text)
    END,
    'month',
    to_jsonb (p_month),
    'portfolioIrrHorizonYears',
    to_jsonb (p_portfolio_irr_horizon_years),
    'ianaTimezone',
    to_jsonb (v_tz)
  );

  v_kpis := jsonb_build_object (
    'monthlyNOI',
    jsonb_build_object (
      'value',
      v_monthly_noi,
      'status',
      v_kpi_stat,
      'operatingIncome',
      v_income_received_total + v_str_net,
      'operatingIncomeActualReceived',
      v_income_received_total + v_str_net,
      'operatingIncomeExpectedFromLedger',
      v_income_expected_m,
      'contractualMonthlyRentFromLeases',
      v_contractual_rent,
      'operatingIncomeProjectedFromLeases',
      v_contractual_rent + v_str_net,
      'operatingExpenses',
      v_op_ex_m,
      'explanation',
      'Income less operating expenses, before debt service. Headline income is received ledger entries plus STR field estimates — not contractual lease rent unless recorded as received.'
    ),
    'monthlyExpenses',
    jsonb_build_object (
      'value',
      v_monthly_exp_tot,
      'operatingExpenses',
      v_op_ex_m,
      'debtService',
      v_debt_m,
      'explanation',
      'Operating costs plus bond repayments.'
    ),
    'trueCashOnCashROI',
    jsonb_build_object (
      'valuePercent',
      CASE
        WHEN v_coc IS NULL THEN NULL
        ELSE round(v_coc * 100::double precision * 100::double precision) / 100
      END,
      'annualPreTaxCashFlow',
      v_annual_pre_tax_cf,
      'totalCashInvested',
      CASE
        WHEN v_total_cash_inv > 0 THEN v_total_cash_inv
        ELSE NULL
      END,
      'classification',
      v_coc_class,
      'explanation',
      'Annual pre-tax cash flow divided by actual cash invested.'
    ),
    'portfolioIRR',
    jsonb_build_object (
      'valuePercent',
      NULL,
      'cashFlows',
      '[]'::jsonb,
      'holdingPeriodYears',
      NULL,
      'projectionGrowth',
      jsonb_build_object (
        'rentalIncomeGrowthPercentAnnual',
        v_growth_rental,
        'totalExpensesGrowthPercentAnnual',
        v_growth_exp
      ),
      'assumptions',
      ARRAY['IRR not calculated in Supabase RPC.']::text[],
      'canCalculate',
      FALSE,
      'diagnostics',
      jsonb_build_object (
        'statusCode',
        'DEFERRED',
        'statusMessage',
        'IRR not calculated in Supabase RPC.',
        'filteredPropertyCount',
        v_total_props,
        'eligiblePropertyCount',
        0,
        'irrSolveAttempted',
        FALSE,
        'irrRatePercent',
        NULL,
        'cf0',
        NULL,
        'yearlyCashFlows',
        '[]'::jsonb,
        'sumUndiscountedCashFlows',
        NULL,
        'holdingHorizonYears',
        NULL,
        'propertyInputs',
        '[]'::jsonb
      ),
      'explanation',
      'Deferred in SQL migration phase; parity with Express bisection IRR is server-side.'
    ),
    'portfolioAnalysisOverTime',
    jsonb_build_object (
      'projectionGrowth',
      jsonb_build_object (
        'rentalIncomeGrowthPercentAnnual',
        v_growth_rental,
        'totalExpensesGrowthPercentAnnual',
        v_growth_exp
      ),
      'appreciationDefaultPercent',
      5,
      'columns',
      '[]'::jsonb,
      'bondHorizonCapYears',
      NULL,
      'analysisLimitedByBondSchedule',
      FALSE,
      'explanation',
      'Deferred in SQL migration phase alongside portfolio IRR.'
    ),
    'totalProperties',
    jsonb_build_object (
      'value',
      v_total_props,
      'breakdown',
      jsonb_build_object (
        'occupied',
        v_occupied,
        'vacant',
        v_vacant,
        'land',
        v_land,
        'shortTerm',
        v_str_count
      )
    )
  );

  v_root := jsonb_build_object (
    'filters',
    v_filters,
    'kpis',
    v_kpis,
    'charts',
    jsonb_build_object (
      'monthlyNOITrend',
      v_charts -> 'monthlyNOITrend',
      'incomeExpenseComposition',
      v_charts -> 'incomeExpenseComposition'
    ),
    'warnings',
    to_jsonb (v_warn),
    'totalProperties',
    v_total_props,
    'propertiesByType',
    coalesce (v_props_by_type, '{}'::jsonb),
    'tenantRequiredProperties',
    v_tenant_req,
    'occupiedProperties',
    v_occupied,
    'vacantRentalProperties',
    v_vacant,
    'landProperties',
    v_land,
    'shortTermRentalProperties',
    v_str_count,
    'occupancyRate',
    CASE
      WHEN v_tenant_req > 0 THEN v_occupied::double precision / v_tenant_req::double precision
      ELSE 0
    END,
    'totalCurrentEstimatedValue',
    v_total_value,
    'totalOutstandingBondBalance',
    v_total_bond,
    'portfolioEquity',
    v_portfolio_equity,
    'totalPurchasePrice',
    v_total_purchase,
    'monthlyRentRoll',
    v_rent_roll,
    'monthlyShortTermRentalRevenue',
    v_str_rev_sum,
    'totalMonthlyIncome',
    v_income_received_total + v_str_net,
    'totalMonthlyIncomeReceived',
    v_income_received_total,
    'totalMonthlyIncomeExpectedLedger',
    v_income_expected_m,
    'contractualMonthlyRentFromLeases',
    v_contractual_rent,
    'totalMonthlyOperatingExpenses',
    v_op_ex_m,
    'totalMonthlyDebtService',
    v_debt_m,
    'monthlyNetCashFlow',
    v_monthly_net_cf,
    'annualNOI',
    v_annual_noi,
    'averageCapRate',
    v_avg_cap,
    'averageGrossYield',
    0,
    'averageNetYield',
    0,
    'operatingExpenseRatio',
    v_oer,
    'depositsHeld',
    v_deposits,
    'rentDue',
    jsonb_build_object (
      'dueSoon',
      v_rent_soon,
      'overdue',
      v_rent_overdue,
      'totalAttention',
      v_rent_soon + v_rent_overdue
    ),
    'leases',
    jsonb_build_object (
      'expiringSoon',
      v_leases_exp,
      'monthToMonth',
      v_leases_mtm,
      'activeFixedTerm',
      v_leases_fixed,
      'cancelledOrTerminated',
      v_leases_cancelled
    ),
    'missingData',
    jsonb_build_object (
      'missingCurrentEstimatedValue',
      v_missing_val,
      'missingOutstandingBondBalance',
      v_missing_bond,
      'missingPurchasePrice',
      v_missing_pp,
      'missingLeaseDocuments',
      v_missing_docs,
      'missingExpenseData',
      v_missing_exp
    ),
    'charts',
    v_charts
  );

  RETURN v_root;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary (text, text[], uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary (text, text[], uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_summary (text, text[], uuid, integer, text) IS
  'Portfolio dashboard JSON; auth.uid(); IRR deferred; see MIGRATION_STATUS parity notes.';
