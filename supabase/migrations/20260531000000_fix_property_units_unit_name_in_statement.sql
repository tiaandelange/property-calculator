-- Fix property_units column refs in statement RPC (unit_name, not unit_label/unit_number).

CREATE OR REPLACE FUNCTION public.get_property_monthly_statement (
  p_property_id uuid,
  p_year integer,
  p_month integer,
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
  v_prop RECORD;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_today_utc date := (timezone ('UTC', now ()))::date;
  v_warn text[] := ARRAY[]::text[];
  v_bond jsonb;
  v_rows jsonb;
  v_summary jsonb;
  v_current_inv jsonb;
  v_deposits jsonb;
  v_future jsonb;
  v_recurring jsonb;
  v_received_m double precision := 0;
  v_expected_m double precision := 0;
  v_inv_paid_m double precision := 0;
  v_exp_op_m double precision := 0;
  v_bond_ledger_m double precision := 0;
  v_bond_profile_m double precision := 0;
  v_bond_this_m double precision := 0;
  v_ledger_exp_debit_m double precision := 0;
  v_net_cf double precision := 0;
  v_balance_due double precision := 0;
  v_deposit_held double precision := 0;
  -- bond finance locals (computePropertyBondFinance)
  v_balance double precision;
  v_rate double precision;
  v_n_rem int;
  v_total_term int;
  v_months_elapsed int;
  v_schedule_used boolean;
  v_bond_ty int;
  v_bond_start date;
  v_bond_start_txt text;
  v_calc_pmt double precision;
  v_calc_int double precision;
  v_calc_prin double precision;
  v_stored_pmt double precision;
  v_pay_m double precision;
  v_int_m double precision;
  v_prin_m double precision;
  v_proj_bal double precision;
  v_i_m double precision;
  v_powv double precision;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_month < 1 OR p_month > 12 OR p_year < 1970 OR p_year > 9999 THEN
    RAISE EXCEPTION 'Invalid calendar month';
  END IF;

  SELECT
    *
  INTO v_prop
  FROM public.properties p
  WHERE
    p.id = p_property_id
    AND p.user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  v_warn := array_append (
    v_warn,
    'RPC does not run materializeDueRecurringExpenses or applyDepositGrowthForCurrentPropertyLeases; Express statement may differ until those run elsewhere.'
  );

  v_month_start := make_timestamptz (p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_month_end := v_month_start + interval '1 month';

  -- -------------------------------------------------------------------------
  -- bondFinance — numeric parity with computePropertyBondFinance (asOf = now UTC)
  -- -------------------------------------------------------------------------
  v_balance := greatest (0, coalesce (v_prop.outstanding_bond_balance, 0));

  IF v_prop.bond_annual_interest_rate_percent IS NOT NULL
  AND v_prop.bond_annual_interest_rate_percent::double precision > 0 THEN
    v_rate := v_prop.bond_annual_interest_rate_percent::double precision;
  ELSE
    v_rate := NULL;
  END IF;

  v_bond_ty := CASE
    WHEN v_prop.bond_term_years IN (5, 10, 15, 20, 25, 30) THEN v_prop.bond_term_years::int
    ELSE NULL
  END;

  v_bond_start := NULL;
  v_bond_start_txt := NULL;

  IF v_prop.bond_start_date IS NOT NULL THEN
    v_bond_start := v_prop.bond_start_date::date;
    v_bond_start_txt := to_char (v_bond_start, 'YYYY-MM-DD');
  END IF;

  v_n_rem := NULL;
  v_total_term := NULL;
  v_months_elapsed := NULL;
  v_schedule_used := FALSE;

  IF v_bond_ty IS NOT NULL
  AND v_bond_start IS NOT NULL THEN
    v_total_term := v_bond_ty * 12;
    v_months_elapsed := greatest (
      0,
      (extract (YEAR FROM v_today_utc) - extract (YEAR FROM v_bond_start))::int * 12
      + (extract (MONTH FROM v_today_utc) - extract (MONTH FROM v_bond_start))::int
    );

    IF extract (DAY FROM v_today_utc) < extract (DAY FROM v_bond_start) THEN
      v_months_elapsed := greatest (0, v_months_elapsed - 1);
    END IF;

    v_months_elapsed := least (v_months_elapsed, v_total_term);
    v_n_rem := greatest (0, v_total_term - v_months_elapsed);
    v_schedule_used := TRUE;
  ELSE
    IF v_prop.bond_remaining_term_months IS NOT NULL
    AND v_prop.bond_remaining_term_months::double precision >= 0 THEN
      v_n_rem := floor (v_prop.bond_remaining_term_months::double precision)::int;
    END IF;
  END IF;

  v_calc_pmt := NULL;

  IF v_rate IS NOT NULL
  AND v_n_rem IS NOT NULL
  AND v_n_rem > 0
  AND v_balance > 0 THEN
    v_i_m := v_rate / 100.0 / 12.0;

    IF v_i_m <= 1e-15 THEN
      v_calc_pmt := round ((v_balance / v_n_rem)::numeric, 2)::double precision;
    ELSE
      v_powv := power (1 + v_i_m, v_n_rem);
      v_calc_pmt := round (((v_balance * v_i_m * v_powv) / (v_powv - 1))::numeric, 2)::double precision;
    END IF;
  END IF;

  v_calc_int := NULL;

  IF v_rate IS NOT NULL
  AND v_balance > 0 THEN
    v_calc_int := round ((v_balance * (v_rate / 100.0 / 12.0))::numeric, 2)::double precision;
  ELSIF v_balance > 0 THEN
    v_calc_int := 0;
  END IF;

  v_calc_prin := NULL;

  IF v_calc_pmt IS NOT NULL
  AND v_calc_int IS NOT NULL THEN
    v_calc_prin := round (greatest (0, v_calc_pmt - v_calc_int)::numeric, 2)::double precision;
  END IF;

  v_stored_pmt := NULL;

  IF v_prop.monthly_bond_payment IS NOT NULL
  AND v_prop.monthly_bond_payment::double precision >= 0 THEN
    v_stored_pmt := greatest (0, v_prop.monthly_bond_payment::double precision);
  END IF;

  v_pay_m := coalesce (v_stored_pmt, v_calc_pmt, 0);
  v_int_m := 0;

  IF v_prop.bond_interest_portion_override IS NOT NULL
  AND v_prop.bond_interest_portion_override::double precision >= 0 THEN
    v_int_m := greatest (0, v_prop.bond_interest_portion_override::double precision);
  ELSE
    v_int_m := coalesce (v_calc_int, 0);
  END IF;

  v_int_m := round (least (v_int_m, v_pay_m)::numeric, 2)::double precision;
  v_prin_m := round (greatest (0, v_pay_m - v_int_m)::numeric, 2)::double precision;

  IF v_prop.bond_principal_portion_override IS NOT NULL
  AND v_prop.bond_principal_portion_override::double precision >= 0 THEN
    v_prin_m := round (greatest (0, v_prop.bond_principal_portion_override::double precision)::numeric, 2)::double precision;
    v_int_m := round (greatest (0, v_pay_m - v_prin_m)::numeric, 2)::double precision;
  END IF;

  v_proj_bal := round (greatest (0, v_balance - v_prin_m)::numeric, 2)::double precision;

  v_bond := jsonb_build_object (
    'outstandingBalance',
    round(v_balance::numeric, 2),
    'annualInterestRatePercent',
    v_rate,
    'remainingTermMonths',
    v_n_rem,
    'bondTermYears',
    v_bond_ty,
    'bondStartDate',
    v_bond_start_txt,
    'totalBondTermMonths',
    v_total_term,
    'monthsElapsedOnBond',
    v_months_elapsed,
    'remainingFromSchedule',
    v_schedule_used,
    'calculatedMonthlyPayment',
    CASE WHEN v_calc_pmt IS NULL THEN NULL ELSE round(v_calc_pmt::numeric, 2) END,
    'calculatedInterestPortion',
    CASE WHEN v_calc_int IS NULL THEN NULL ELSE round(v_calc_int::numeric, 2) END,
    'calculatedPrincipalPortion',
    CASE WHEN v_calc_prin IS NULL THEN NULL ELSE round(v_calc_prin::numeric, 2) END,
    'monthlyBondPaymentStored',
    CASE WHEN v_stored_pmt IS NULL THEN NULL ELSE round(v_stored_pmt::numeric, 2) END,
    'bondInterestPortionOverride',
    CASE
      WHEN v_prop.bond_interest_portion_override IS NULL THEN NULL
      ELSE round(v_prop.bond_interest_portion_override::numeric, 2)
    END,
    'bondPrincipalPortionOverride',
    CASE
      WHEN v_prop.bond_principal_portion_override IS NULL THEN NULL
      ELSE round(v_prop.bond_principal_portion_override::numeric, 2)
    END,
    'paymentThisMonth',
    round(v_pay_m::numeric, 2),
    'interestThisMonth',
    v_int_m,
    'principalThisMonth',
    v_prin_m,
    'projectedBalanceAfterPayment',
    v_proj_bal
  );

  -- -------------------------------------------------------------------------
  -- statementRows (merged income + expense + invoice; sort date, id)
  -- -------------------------------------------------------------------------
  WITH
  inc_rows AS (
    SELECT
      concat ('INCOME:', i.id::text) AS rid,
      to_char (i.income_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
      concat (i.category::text, ': ', i.description) AS descr,
      CASE
        WHEN i.status = 'RECEIVED' THEN 'Income (received)'
        ELSE 'Income (expected)'
      END AS typ,
      CASE
        WHEN i.status = 'EXPECTED' THEN round(i.amount::numeric, 2)
        ELSE NULL
      END AS debit,
      CASE
        WHEN i.status = 'RECEIVED' THEN round(i.amount::numeric, 2)
        ELSE NULL
      END AS credit,
      'INCOME'::text AS src,
      i.id::text AS src_id,
      i.status::text AS st,
      i.category::text AS inc_cat,
      i.description AS inc_desc_plain,
      NULL::text AS exp_cat,
      NULL::double precision AS bond_int_amt,
      NULL::double precision AS bond_prin_amt,
      NULL::text AS inv_num,
      NULL::text AS inv_notes,
      NULL::boolean AS inv_bal,
      i.lease_id::text AS lease_id_txt,
      NULL::text AS stmt_type,
      i.tenant_id::text AS tenant_id_txt,
      NULL::text AS unit_id_txt,
      p_property_id::text AS property_id_txt
    FROM public.income_entries i
    WHERE
      i.property_id = p_property_id
      AND i.user_id = v_uid
      AND i.status IS DISTINCT FROM 'ARCHIVED'
      AND (i.archived_at IS NULL)
      AND (
        p_include_expected
        OR i.status <> 'EXPECTED'
      )
  ),
  exp_rows AS (
    SELECT
      concat ('EXPENSE:', e.id::text) AS rid,
      to_char (e.expense_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
      e.description AS descr,
      CASE
        WHEN e.is_recurring THEN concat (
          'Expense (recurring — ',
          CASE e.category
            WHEN 'RATES_TAXES' THEN 'Rates and Taxes'
            WHEN 'WATER' THEN 'Water'
            WHEN 'ELECTRICITY' THEN 'Electricity'
            WHEN 'LEVIES' THEN 'Levies'
            WHEN 'INSURANCE' THEN 'Insurance'
            WHEN 'MAINTENANCE' THEN 'Maintenance'
            WHEN 'REPAIRS' THEN 'Repairs'
            WHEN 'MANAGEMENT_FEES' THEN 'Management Fees'
            WHEN 'BOND_PAYMENT' THEN 'Bond Payment'
            WHEN 'ACCOUNTING' THEN 'Accounting'
            WHEN 'OTHER' THEN 'Other'
            ELSE e.category::text
          END,
          ')'
        )
        ELSE concat (
          'Expense (',
          CASE e.category
            WHEN 'RATES_TAXES' THEN 'Rates and Taxes'
            WHEN 'WATER' THEN 'Water'
            WHEN 'ELECTRICITY' THEN 'Electricity'
            WHEN 'LEVIES' THEN 'Levies'
            WHEN 'INSURANCE' THEN 'Insurance'
            WHEN 'MAINTENANCE' THEN 'Maintenance'
            WHEN 'REPAIRS' THEN 'Repairs'
            WHEN 'MANAGEMENT_FEES' THEN 'Management Fees'
            WHEN 'BOND_PAYMENT' THEN 'Bond Payment'
            WHEN 'ACCOUNTING' THEN 'Accounting'
            WHEN 'OTHER' THEN 'Other'
            ELSE e.category::text
          END,
          ')'
        )
      END AS typ,
      round(e.amount::numeric, 2) AS debit,
      NULL::numeric AS credit,
      'EXPENSE'::text AS src,
      e.id::text AS src_id,
      e.status::text AS st,
      NULL::text AS inc_cat,
      NULL::text AS inc_desc_plain,
      e.category::text AS exp_cat,
      CASE
        WHEN e.category = 'BOND_PAYMENT' THEN e.bond_interest_amount
        ELSE NULL
      END AS bond_int_amt,
      CASE
        WHEN e.category = 'BOND_PAYMENT' THEN e.bond_principal_amount
        ELSE NULL
      END AS bond_prin_amt,
      NULL::text AS inv_num,
      NULL::text AS inv_notes,
      NULL::boolean AS inv_bal,
      NULL::text AS lease_id_txt,
      NULL::text AS stmt_type,
      NULL::text AS tenant_id_txt,
      NULL::text AS unit_id_txt,
      p_property_id::text AS property_id_txt
    FROM public.expense_entries e
    WHERE
      e.property_id = p_property_id
      AND e.user_id = v_uid
      AND e.status IS DISTINCT FROM 'ARCHIVED'
      AND (e.archived_at IS NULL)
      AND NOT (
        e.is_recurring = TRUE
        AND e.recurring_schedule_parent_id IS NULL
      )
  ),
  inv_rows AS (
    SELECT
      concat ('INVOICE:', inv.id::text) AS rid,
      to_char (coalesce (inv.due_date, inv.issue_date, inv.invoice_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
      CASE
        WHEN inv.invoice_type = 'RENT'::public.app_invoice_type THEN
          concat (
            'Monthly Rent — ',
            coalesce(nullif(trim(concat_ws(' ', tn.first_name, tn.last_name)), ''), 'Tenant'),
            CASE
              WHEN pu.unit_name IS NOT NULL AND trim(pu.unit_name) <> '' THEN concat(' / ', pu.unit_name)
              ELSE ''
            END,
            ' — ',
            coalesce(inv.invoice_period, to_char(coalesce(inv.due_date, inv.issue_date, inv.invoice_date) AT TIME ZONE 'UTC', 'YYYY-MM'))
          )
        WHEN trim(coalesce(inv.notes, '')) <> '' THEN concat('Invoice ', inv.invoice_number, ' — ', trim(inv.notes))
        ELSE concat('Invoice ', inv.invoice_number)
      END AS descr,
      CASE
        WHEN inv.status = 'PAID' THEN 'Invoice (paid)'
        WHEN inv.invoice_type = 'RENT'::public.app_invoice_type THEN concat('Rent invoice (', lower(inv.status::text), ')')
        ELSE concat('Invoice (', lower(inv.status::text), ')')
      END AS typ,
      NULL::numeric AS debit,
      round(coalesce(inv.total_amount, inv.total)::numeric, 2) AS credit,
      'INVOICE'::text AS src,
      inv.id::text AS src_id,
      inv.status::text AS st,
      NULL::text AS inc_cat,
      NULL::text AS inc_desc_plain,
      NULL::text AS exp_cat,
      NULL::double precision AS bond_int_amt,
      NULL::double precision AS bond_prin_amt,
      inv.invoice_number AS inv_num,
      coalesce(inv.notes, '') AS inv_notes,
      inv.status = 'PAID' AS inv_bal,
      inv.lease_id::text AS lease_id_txt,
      CASE
        WHEN inv.invoice_type = 'RENT'::public.app_invoice_type THEN 'rent_invoice'
        WHEN inv.invoice_type = 'UTILITY_RECOVERY'::public.app_invoice_type THEN 'utility_recovery_invoice'
        ELSE 'invoice'
      END AS stmt_type,
      inv.tenant_id::text AS tenant_id_txt,
      inv.unit_id::text AS unit_id_txt,
      inv.property_id::text AS property_id_txt
    FROM public.invoices inv
      LEFT JOIN public.tenants tn ON tn.id = inv.tenant_id
      LEFT JOIN public.property_units pu ON pu.id = inv.unit_id
    WHERE
      inv.property_id = p_property_id
      AND inv.user_id = v_uid
      AND inv.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
      AND (inv.archived_at IS NULL)
  ),
  merged AS (
    SELECT
      *
    FROM inc_rows
    UNION ALL
    SELECT
      *
    FROM exp_rows
    UNION ALL
    SELECT
      *
    FROM inv_rows
  ),
  ordered AS (
    SELECT
      m.*,
      sum(
        CASE
          WHEN m.src = 'INVOICE'
          AND m.st <> 'PAID' THEN 0
          ELSE coalesce (m.credit, 0::numeric)
        END - coalesce (m.debit, 0::numeric)
      ) OVER (
        ORDER BY
          m.d,
          m.rid ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS run_bal
    FROM merged m
  )
  SELECT
    coalesce (
      jsonb_agg (
        jsonb_build_object (
          'id',
          rid,
          'date',
          d,
          'description',
          descr,
          'type',
          typ,
          'debit',
          debit,
          'credit',
          credit,
          'balance',
          round(run_bal::numeric, 2),
          'source',
          src,
          'sourceId',
          src_id,
          'status',
          st,
          'actions',
          '[]'::jsonb,
          'invoiceCountsTowardBalance',
          inv_bal,
          'leaseId',
          lease_id_txt,
          'expenseCategory',
          exp_cat,
          'bondInterestAmount',
          bond_int_amt,
          'bondPrincipalAmount',
          bond_prin_amt,
          'incomeCategory',
          inc_cat,
          'incomeDescriptionPlain',
          inc_desc_plain,
          'invoiceNumber',
          inv_num,
          'invoiceNotes',
          inv_notes,
          'invoiceId',
          src_id,
          'statementType',
          stmt_type,
          'tenantId',
          tenant_id_txt,
          'unitId',
          unit_id_txt,
          'propertyId',
          property_id_txt,
          'reference',
          inv_num
        )
        ORDER BY
          d,
          rid
      ),
      '[]'::jsonb
    )
  INTO v_rows
  FROM ordered;

  -- -------------------------------------------------------------------------
  -- summary (UTC calendar month — utcCalendarMonthBounds)
  -- -------------------------------------------------------------------------
  SELECT
    coalesce (
      sum (i.amount) FILTER (
        WHERE
          i.status = 'RECEIVED'
          AND i.income_date >= v_month_start
          AND i.income_date < v_month_end
      ),
      0
    ),
    coalesce (
      sum (i.amount) FILTER (
        WHERE
          i.status = 'EXPECTED'
          AND i.income_date >= v_month_start
          AND i.income_date < v_month_end
      ),
      0
    )
  INTO v_received_m, v_expected_m
  FROM public.income_entries i
  WHERE
    i.property_id = p_property_id
    AND i.user_id = v_uid
    AND i.status IS DISTINCT FROM 'ARCHIVED'
    AND (i.archived_at IS NULL);

  SELECT
    coalesce (sum (inv.total), 0) INTO v_inv_paid_m
  FROM public.invoices inv
  WHERE
    inv.property_id = p_property_id
    AND inv.user_id = v_uid
    AND inv.status = 'PAID'
    AND inv.invoice_date >= v_month_start
    AND inv.invoice_date < v_month_end;

  v_received_m := v_received_m + v_inv_paid_m;

  SELECT
    coalesce (
      sum (e.amount) FILTER (
        WHERE
          e.category <> 'BOND_PAYMENT'
      ),
      0
    ),
    coalesce (
      sum (e.amount) FILTER (
        WHERE
          e.category = 'BOND_PAYMENT'
      ),
      0
    ),
    coalesce (sum (e.amount), 0)
  INTO v_exp_op_m, v_bond_ledger_m, v_ledger_exp_debit_m
  FROM public.expense_entries e
  WHERE
    e.property_id = p_property_id
    AND e.user_id = v_uid
    AND e.status = 'ACTIVE'
    AND (e.archived_at IS NULL)
    AND NOT (
      e.is_recurring = TRUE
      AND e.recurring_schedule_parent_id IS NULL
    )
    AND e.expense_date >= v_month_start
    AND e.expense_date < v_month_end;

  v_bond_profile_m := CASE
    WHEN v_bond_ledger_m <= 0 THEN greatest (0, coalesce (v_prop.monthly_bond_payment, 0))
    ELSE 0
  END;

  v_bond_this_m := v_bond_ledger_m + v_bond_profile_m;
  v_net_cf := v_received_m - v_ledger_exp_debit_m - v_bond_profile_m;

  SELECT
    coalesce (sum (inv.total), 0) INTO v_balance_due
  FROM public.invoices inv
  WHERE
    inv.property_id = p_property_id
    AND inv.user_id = v_uid
    AND inv.status = ANY (ARRAY['DRAFT', 'GENERATED', 'SENT', 'DUE', 'PARTIALLY_PAID', 'OVERDUE']::app_invoice_status[])
    AND (inv.archived_at IS NULL);

  SELECT
    coalesce (sum (l.deposit_amount), 0) INTO v_deposit_held
  FROM public.leases l
  WHERE
    l.property_id = p_property_id
    AND (
      CASE
        WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
        WHEN l.status = 'ACTIVE'
        AND l.fixed_term_end_date IS NOT NULL
        AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
        ELSE l.status::text
      END
    ) IN ('ACTIVE', 'MONTH_TO_MONTH');

  v_summary := jsonb_build_object (
    'balanceDue',
    round(v_balance_due::numeric, 2),
    'expectedThisMonth',
    round(v_expected_m::numeric, 2),
    'receivedThisMonth',
    round(v_received_m::numeric, 2),
    'expensesThisMonth',
    round(v_exp_op_m::numeric, 2),
    'bondThisMonth',
    round(v_bond_this_m::numeric, 2),
    'netCashFlow',
    round(v_net_cf::numeric, 2),
    'depositHeld',
    round(v_deposit_held::numeric, 2)
  );

  -- -------------------------------------------------------------------------
  -- currentInvoice (UTC month window; newest by created_at)
  -- -------------------------------------------------------------------------
  SELECT
    to_jsonb (inv.*) || jsonb_build_object (
      'invoice_line_items',
      coalesce (
        (
          SELECT
            jsonb_agg (to_jsonb (li) ORDER BY li.created_at)
          FROM public.invoice_line_items li
          WHERE
            li.invoice_id = inv.id
        ),
        '[]'::jsonb
      ),
      'tenants',
      CASE
        WHEN t.id IS NULL THEN NULL
        ELSE to_jsonb (t)
      END
    )
  INTO v_current_inv
  FROM public.invoices inv
    LEFT JOIN public.tenants t ON t.id = inv.tenant_id
  WHERE
    inv.property_id = p_property_id
    AND inv.user_id = v_uid
    AND inv.status NOT IN ('CANCELLED'::public.app_invoice_status, 'VOID'::public.app_invoice_status)
    AND (inv.archived_at IS NULL)
    AND coalesce(inv.due_date, inv.issue_date, inv.invoice_date) >= v_month_start
    AND inv.invoice_date < v_month_end
  ORDER BY
    inv.created_at DESC
  LIMIT
    1;

  -- -------------------------------------------------------------------------
  -- deposits (current leases)
  -- -------------------------------------------------------------------------
  SELECT
    coalesce (
      jsonb_agg (
        jsonb_build_object (
          'leaseId',
          l.id::text,
          'tenantName',
          CASE
            WHEN tn.id IS NOT NULL THEN concat_ws (' ', tn.first_name, tn.last_name)
            ELSE NULL
          END,
          'amount',
          l.deposit_amount,
          'depositAnnualGrowthPercent',
          l.deposit_annual_growth_percent,
          'depositGrowthLastAppliedMonth',
          l.deposit_growth_last_applied_month
        )
        ORDER BY
          l.created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_deposits
  FROM public.leases l
    LEFT JOIN public.tenants tn ON tn.id = l.tenant_id
  WHERE
    l.property_id = p_property_id
    AND (
      CASE
        WHEN l.status IN ('CANCELLED', 'TERMINATED', 'EXPIRED', 'DRAFT') THEN l.status::text
        WHEN l.status = 'ACTIVE'
        AND l.fixed_term_end_date IS NOT NULL
        AND l.fixed_term_end_date < now () THEN 'MONTH_TO_MONTH'
        ELSE l.status::text
      END
    ) IN ('ACTIVE', 'MONTH_TO_MONTH');

  -- -------------------------------------------------------------------------
  -- futureCharges (shouldExcludeExpenseFromLandlordCharges in TS)
  -- -------------------------------------------------------------------------
  SELECT
    coalesce (
      jsonb_agg (
        jsonb_build_object (
          'label',
          concat (
            CASE e.category
              WHEN 'RATES_TAXES' THEN 'Rates and Taxes'
              WHEN 'WATER' THEN 'Water'
              WHEN 'ELECTRICITY' THEN 'Electricity'
              WHEN 'LEVIES' THEN 'Levies'
              WHEN 'INSURANCE' THEN 'Insurance'
              WHEN 'MAINTENANCE' THEN 'Maintenance'
              WHEN 'REPAIRS' THEN 'Repairs'
              WHEN 'MANAGEMENT_FEES' THEN 'Management Fees'
              WHEN 'BOND_PAYMENT' THEN 'Bond Payment'
              WHEN 'ACCOUNTING' THEN 'Accounting'
              WHEN 'OTHER' THEN 'Other'
              ELSE e.category::text
            END,
            ': ',
            e.description
          ),
          'description',
          e.description,
          'amount',
          round(e.amount::numeric, 2),
          'dueDate',
          to_char (e.expense_date AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          'dueMonth',
          to_char (e.expense_date AT TIME ZONE 'UTC', 'YYYY-MM'),
          'source',
          concat ('EXPENSE:', e.id::text),
          'category',
          e.category::text,
          'expenseId',
          e.id::text
        )
        ORDER BY
          e.expense_date,
          e.id
      ),
      '[]'::jsonb
    )
  INTO v_future
  FROM public.expense_entries e
  WHERE
    e.property_id = p_property_id
    AND e.user_id = v_uid
    AND e.status = 'ACTIVE'
    AND (e.archived_at IS NULL)
    AND e.is_recurring = FALSE
    AND (e.expense_date AT TIME ZONE 'UTC')::date > v_today_utc
    AND e.source::text <> 'INVOICE'
    AND NOT (
      lower(trim(e.description)) ~ '^expected\\s+rent'
      OR lower(e.description) ~ '\\brecurring\\s+income\\s+rule\\b'
      OR lower(e.description) ~ '^recurring\\s+invoice\\b'
      OR lower(e.description) ~ '^invoice\\s+line\\b'
      OR trim(e.description) ~* '^monthly\\s+rent\\s*$'
    );

  -- -------------------------------------------------------------------------
  -- recurringCharges
  -- -------------------------------------------------------------------------
  SELECT
    coalesce (
      jsonb_agg (
        jsonb_build_object (
          'kind',
          'RECURRING_EXPENSE',
          'id',
          e.id::text,
          'description',
          e.description,
          'amount',
          round(e.amount::numeric, 2),
          'frequency',
          coalesce (e.recurring_frequency::text, 'MONTHLY'),
          'category',
          e.category::text,
          'expenseDate',
          to_char (e.expense_date AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          'recurringStartDate',
          CASE
            WHEN e.recurring_start_date IS NULL THEN NULL
            ELSE to_char (e.recurring_start_date, 'YYYY-MM-DD')
          END,
          'recurringEndDate',
          CASE
            WHEN e.recurring_end_date IS NULL THEN NULL
            ELSE to_char (e.recurring_end_date, 'YYYY-MM-DD')
          END,
          'recurringOpenEnded',
          e.recurring_open_ended,
          'recurringMonthAnchor',
          e.recurring_month_anchor::text,
          'recurringDayOfMonth',
          e.recurring_day_of_month
        )
        ORDER BY
          e.expense_date DESC,
          e.id DESC
      ),
      '[]'::jsonb
    )
  INTO v_recurring
  FROM public.expense_entries e
  WHERE
    e.property_id = p_property_id
    AND e.user_id = v_uid
    AND e.status = 'ACTIVE'
    AND (e.archived_at IS NULL)
    AND e.is_recurring = TRUE
    AND e.category <> 'BOND_PAYMENT'
    AND e.source::text <> 'INVOICE'
    AND NOT (
      lower(trim(e.description)) ~ '^expected\\s+rent'
      OR lower(e.description) ~ '\\brecurring\\s+income\\s+rule\\b'
      OR lower(e.description) ~ '^recurring\\s+invoice\\b'
      OR lower(e.description) ~ '^invoice\\s+line\\b'
      OR trim(e.description) ~* '^monthly\\s+rent\\s*$'
    );

  RETURN jsonb_build_object (
    'warnings',
    to_jsonb (v_warn),
    'bondFinance',
    v_bond,
    'property',
    jsonb_build_object (
      'id',
      v_prop.id::text,
      'name',
      v_prop.name,
      'investmentType',
      v_prop.investment_type::text,
      'city',
      v_prop.city,
      'addressLine1',
      v_prop.address_line1
    ),
    'summary',
    v_summary,
    'statementRows',
    v_rows,
    'currentInvoice',
    v_current_inv,
    'deposits',
    v_deposits,
    'futureCharges',
    v_future,
    'recurringCharges',
    v_recurring
  );
END;

$function$;
