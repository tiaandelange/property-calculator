/**
 * Assembles PropertyInvestmentReportModel from calculator INVESTMENT_REPORT payload.
 */

import {
  buildCalculatorIncomeExpenseRows,
  buildCalculatorLoanAssumptionRows,
  buildCalculatorPropertyInformationRows
} from "./pdf/reportDisplayMapper.js";
import {
  formatPct,
  formatZar,
  irrPercent,
  PROJECTION_YEAR_COLUMNS,
  projectLoanBalanceAfterYears,
  projectValue,
  type PropertyInvestmentReportModel
} from "./propertyInvestmentReportData.js";

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(x) ? x : null;
}

function propertyTypeLabel(id: string): string {
  const map: Record<string, string> = {
    "single-family": "Single-family home",
    multifamily: "Multifamily",
    condo: "Condo / townhouse",
    commercial: "Commercial",
    land: "Land",
    "short-term-rental": "Short-term rental"
  };
  return map[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function assembleCalculatorInvestmentReportData(opts: {
  propertyType: string;
  answers: Record<string, unknown>;
  metrics: Record<string, unknown>;
  generatedAt?: Date;
  projectionAssumptions?: {
    annualIncomeGrowthPercentAnnual?: number | null;
    expenseGrowthPercentAnnual?: number | null;
    propertyAppreciationPercentAnnual?: number | null;
  } | null;
}): PropertyInvestmentReportModel {
  const now = opts.generatedAt ?? new Date();
  const answers = opts.answers ?? {};
  const metrics = opts.metrics ?? {};
  const typeLabel = propertyTypeLabel(String(opts.propertyType || "").trim() || "Property");

  const monthlyIncome = parseNum(metrics.monthlyIncome) ?? 0;
  const monthlyExpenses = parseNum(metrics.monthlyExpenses) ?? 0;
  const monthlyCashFlow =
    parseNum(metrics.projectedCashFlow ?? metrics.monthlyCashFlow) ?? monthlyIncome - monthlyExpenses;
  const monthlyLoanPayment = parseNum(metrics.monthlyBondPayment) ?? 0;
  const monthlyOperating = Math.max(0, monthlyExpenses - monthlyLoanPayment);

  const purchasePrice = parseNum(answers.purchasePrice);
  const marketValue = parseNum(answers.marketValue) ?? purchasePrice;
  const cashInvested = parseNum(answers.cashInvested);
  const loanAmount = parseNum(answers.loanAmount);
  const ratePct = parseNum(answers.interestRateApr);
  const defaults = opts.projectionAssumptions ?? null;
  const incomeGrowthPct =
    defaults?.annualIncomeGrowthPercentAnnual != null ? defaults.annualIncomeGrowthPercentAnnual : 6;
  const expenseGrowthPct =
    defaults?.expenseGrowthPercentAnnual != null ? defaults.expenseGrowthPercentAnnual : 6;
  const appreciationPct =
    parseNum(answers.expectedAppreciationPct) ??
    (defaults?.propertyAppreciationPercentAnnual != null ? defaults.propertyAppreciationPercentAnnual : 6);
  const termYears = parseNum(answers.loanTermYears) ?? parseNum(answers.amortizationYears);

  const equity =
    marketValue != null && loanAmount != null ? marketValue - loanAmount : marketValue ?? null;
  const ltv = parseNum(metrics.ltv);
  const grossYield = parseNum(metrics.grossYield);
  const cashOnCash = parseNum(metrics.cashOnCashRoi);
  const irrVal = parseNum(metrics.internalRateofReturn ?? metrics.internalRateOfReturn);

  const units = metrics.unitsOccupied as { occupied?: number; total?: number } | null | undefined;
  const occupancyLabel =
    units?.total != null && units.total > 0
      ? `${Math.round(((units.occupied ?? 0) / units.total) * 100)}%`
      : parseNum(answers.occupancyPct) != null
        ? `${parseNum(answers.occupancyPct)!.toFixed(0)}%`
        : null;

  const propertyDetails = buildCalculatorPropertyInformationRows(answers, metrics, typeLabel);
  const monthlyIncomeExpense = buildCalculatorIncomeExpenseRows(answers, metrics);
  const assumptions = buildCalculatorLoanAssumptionRows(answers, metrics);

  const rates = parseNum(answers.ratesTaxesMonthly) ?? 0;
  const insurance = parseNum(answers.insuranceMonthly) ?? 0;
  const maintenance = parseNum(answers.maintenanceReserveMonthly) ?? 0;
  const hoa = parseNum(answers.hoaLeviesMonthly) ?? 0;
  const utilities = parseNum(answers.utilitiesMonthly) ?? 0;
  const mgmtPct = parseNum(answers.managementFeePct);
  const mgmtMonthly = mgmtPct != null && monthlyIncome > 0 ? (monthlyIncome * mgmtPct) / 100 : 0;

  const expenseBreakdown: { label: string; amount: number }[] = [];
  if (rates > 0) expenseBreakdown.push({ label: "Rates & taxes", amount: rates });
  if (insurance > 0) expenseBreakdown.push({ label: "Insurance", amount: insurance });
  if (maintenance > 0) expenseBreakdown.push({ label: "Maintenance", amount: maintenance });
  if (mgmtMonthly > 0) expenseBreakdown.push({ label: "Management fee", amount: mgmtMonthly });
  if (hoa > 0) expenseBreakdown.push({ label: "HOA / levies", amount: hoa });
  if (utilities > 0) expenseBreakdown.push({ label: "Utilities", amount: utilities });
  if (monthlyLoanPayment > 0) expenseBreakdown.push({ label: "Loan payment", amount: monthlyLoanPayment });

  const yearCols = [...PROJECTION_YEAR_COLUMNS];
  const baseAnnualIncome = monthlyIncome * 12;
  const baseAnnualExpenses = monthlyOperating * 12;
  const baseValue = marketValue ?? purchasePrice ?? 0;
  const startLoan = loanAmount ?? 0;

  const projIncome = yearCols.map((y) => projectValue(baseAnnualIncome, incomeGrowthPct, y));
  const projExpenses = yearCols.map((y) => projectValue(baseAnnualExpenses, expenseGrowthPct, y));
  const projNoi = yearCols.map((_, i) => {
    const inc = projIncome[i];
    const exp = projExpenses[i];
    if (inc == null || exp == null) return null;
    return inc - exp;
  });
  const projCashFlow = yearCols.map((_, i) => {
    const inc = projIncome[i];
    const exp = projExpenses[i];
    if (inc == null || exp == null) return null;
    return inc - exp - monthlyLoanPayment * 12;
  });
  const projValue = yearCols.map((y) => projectValue(baseValue, appreciationPct, y));
  const projLoan = yearCols.map((y) =>
    startLoan > 0 ? projectLoanBalanceAfterYears(startLoan, monthlyLoanPayment, ratePct, y) : 0
  );
  const projEquity = yearCols.map((_, i) => {
    const pv = projValue[i];
    const lb = projLoan[i];
    if (pv == null || lb == null) return null;
    return pv - lb;
  });
  const projCoC = yearCols.map((_, i) => {
    const cf = projCashFlow[i];
    if (cf == null || cashInvested == null || cashInvested <= 0) return null;
    return Number(((cf / cashInvested) * 100).toFixed(2));
  });

  const irrByHorizon = yearCols.map((hYears) => {
    if (cashInvested == null || cashInvested <= 0) return null;
    const flows: number[] = [];
    for (let t = 1; t <= hYears; t++) {
      const inc = projectValue(baseAnnualIncome, incomeGrowthPct, t);
      const exp = projectValue(baseAnnualExpenses, expenseGrowthPct, t);
      if (inc == null || exp == null) return null;
      flows.push(inc - exp - monthlyLoanPayment * 12);
    }
    const pv = projectValue(baseValue, appreciationPct, hYears);
    const lb = startLoan > 0 ? projectLoanBalanceAfterYears(startLoan, monthlyLoanPayment, ratePct, hYears) : 0;
    if (pv == null || lb == null) return null;
    flows[flows.length - 1] = (flows[flows.length - 1] ?? 0) + (pv - lb);
    return irrPercent(cashInvested, flows);
  });

  const twoPercentRule =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome > 0
      ? Number(((monthlyIncome / purchasePrice) * 100).toFixed(2))
      : null;

  const fiftyPctExpenses = monthlyIncome * 0.5;
  const ruleCashFlow =
    monthlyIncome > 0 ? monthlyIncome - fiftyPctExpenses - monthlyLoanPayment : null;
  const meets50 = monthlyIncome > 0 ? monthlyOperating <= fiftyPctExpenses : false;

  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });

  const noiMonthly = monthlyIncome - monthlyOperating;

  return {
    generatedAt: now.toISOString(),
    reportingPeriodLabel: monthLabel,
    property: {
      name: typeLabel,
      address: "",
      propertyType: typeLabel,
      investmentType: "Calculator scenario",
      imageNote: "No property image available"
    },
    propertyDetails,
    monthlyIncomeExpense,
    propertyInfo: propertyDetails,
    metrics: {
      monthlyIncome,
      monthlyExpenses,
      monthlyCashFlow,
      totalCashNeeded: cashInvested,
      marketValue,
      purchasePrice,
      equity,
      occupancyLabel,
      grossRentalYield: grossYield,
      internalRateOfReturn: irrVal ?? irrByHorizon[0] ?? null,
      cashOnCashRoi: cashOnCash,
      capRate: parseNum(metrics.netYield),
      twoPercentRule,
      ltv
    },
    assumptions,
    expenseBreakdown,
    projection: {
      years: yearCols,
      rows: [
        {
          label: "Total annual income",
          values: projIncome.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Total annual expenses",
          values: projExpenses.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Net operating income",
          values: projNoi.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Total annual cash flow",
          values: projCashFlow.map((v) => (v == null ? "—" : formatZar(v)))
        },
        { label: "Property value", values: projValue.map((v) => (v == null ? "—" : formatZar(v))) },
        { label: "Equity", values: projEquity.map((v) => (v == null ? "—" : formatZar(v))) },
        {
          label: "Loan balance",
          values: projLoan.map((v) => (v == null ? "—" : formatZar(v)))
        },
        {
          label: "Cash on cash ROI",
          values: projCoC.map((v) => (v == null ? "—" : formatPct(v)))
        }
      ]
    },
    actuals: [],
    comparison: [
      {
        metric: "Gross Rent",
        projected: formatZar(monthlyIncome),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Total Expenses",
        projected: formatZar(monthlyExpenses),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Net Operating Income",
        projected: formatZar(noiMonthly),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Cash Flow After Debt Service",
        projected: formatZar(monthlyCashFlow),
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      },
      {
        metric: "Occupancy",
        projected: occupancyLabel ?? "—",
        actual: "—",
        difference: "—",
        variancePercent: "—",
        status: "—"
      }
    ],
    leases: [],
    fiftyPercentRule: [
      { label: "Monthly Gross Rent", value: formatZar(monthlyIncome) },
      { label: "50% of Gross Rent", value: formatZar(fiftyPctExpenses) },
      { label: "Total Monthly Expenses", value: formatZar(monthlyOperating) },
      { label: "Monthly Loan Payment", value: monthlyLoanPayment > 0 ? formatZar(monthlyLoanPayment) : "—" },
      {
        label: "Rule Cash Flow",
        value: ruleCashFlow != null && Number.isFinite(ruleCashFlow) ? formatZar(ruleCashFlow) : "—"
      },
      {
        label: "Result",
        value:
          monthlyIncome <= 0
            ? "Insufficient Data"
            : meets50
              ? "Meets 50% Rule"
              : "Does Not Meet 50% Rule"
      },
      {
        label: "Expenses vs gross rent",
        value:
          monthlyIncome > 0
            ? `Expenses are ${formatPct((monthlyOperating / monthlyIncome) * 100)} of gross rent`
            : "—"
      }
    ]
  };
}
