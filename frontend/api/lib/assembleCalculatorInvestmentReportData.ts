/**
 * Assembles PropertyInvestmentReportModel from calculator INVESTMENT_REPORT payload.
 */

import {
  buildCalculatorIncomeExpenseRows,
  buildCalculatorLoanAssumptionRows,
  buildCalculatorPropertyInformationRows
} from "./pdf/reportDisplayMapper.js";
import {
  calculateIRRByProjectionYear,
  resolveDefaultIrr,
  projectLoanBalanceAfterYears,
  projectValue,
  type IrrByYearEntry
} from "./propertyCalculatorServer.js";
import {
  buildExecutiveSummary,
  derivePdfInvestmentRating
} from "./reportInvestmentRating.js";
import {
  fiftyPercentRuleResult,
  formatPct,
  formatZar,
  PROJECTION_YEAR_COLUMNS,
  type PropertyInvestmentReportModel
} from "./propertyInvestmentReportData.js";

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Gross rent from calculator answers; metrics.monthlyIncome is often effective (post-vacancy). */
function resolveCalculatorGrossMonthlyIncome(
  answers: Record<string, unknown>,
  metricsIncome: number
): number {
  const rent = parseNum(answers.monthlyRent);
  if (rent != null && rent > 0) return rent;
  const unitSum =
    (parseNum(answers.unit1Rent) ?? 0) +
    (parseNum(answers.unit2Rent) ?? 0) +
    (parseNum(answers.unit3Rent) ?? 0) +
    (parseNum(answers.unit4Rent) ?? 0);
  if (unitSum > 0) return unitSum;
  const vacancyPct = parseNum(answers.vacancyAllowancePct);
  if (metricsIncome > 0 && vacancyPct != null && vacancyPct > 0 && vacancyPct < 100) {
    return metricsIncome / (1 - vacancyPct / 100);
  }
  return metricsIncome;
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

  const metricsIncome = parseNum(metrics.monthlyIncome) ?? 0;
  const monthlyGrossIncome = resolveCalculatorGrossMonthlyIncome(answers, metricsIncome);
  const monthlyIncome = monthlyGrossIncome;
  const monthlyLoanPayment = parseNum(metrics.monthlyBondPayment) ?? 0;
  const monthlyOperating = parseNum(metrics.monthlyExpenses) ?? 0;
  const monthlyExpenses = monthlyOperating + monthlyLoanPayment;
  const monthlyCashFlow =
    parseNum(metrics.projectedCashFlow ?? metrics.monthlyCashFlow) ??
    metricsIncome - monthlyExpenses;

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
  const metricsIrrByYear = Array.isArray(metrics.irrByYear)
    ? (metrics.irrByYear as IrrByYearEntry[])
    : null;

  const units = metrics.unitsOccupied as { occupied?: number; total?: number } | null | undefined;
  const occupancyLabel =
    units?.total != null && units.total > 0
      ? `${Math.round(((units.occupied ?? 0) / units.total) * 100)}%`
      : parseNum(answers.occupancyPct) != null
        ? `${parseNum(answers.occupancyPct)!.toFixed(0)}%`
        : null;

  const propertyDetails = buildCalculatorPropertyInformationRows(answers, metrics, typeLabel);
  const monthlyIncomeExpense = buildCalculatorIncomeExpenseRows(answers, metrics, monthlyGrossIncome);
  const assumptions = buildCalculatorLoanAssumptionRows(answers, metrics, {
    incomeGrowthPct,
    expenseGrowthPct,
    appreciationPct
  });

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
  const baseAnnualIncome = metricsIncome * 12;
  const baseAnnualExpenses = monthlyOperating * 12;
  const baseValue = marketValue ?? purchasePrice ?? 0;
  const startLoan = loanAmount ?? 0;

  const projMonthlyGross = yearCols.map((y) => projectValue(monthlyGrossIncome, incomeGrowthPct, y));
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

  const sellingCostPct = parseNum(answers.sellingCostsPercent) ?? parseNum(answers.sellingCostPct);
  const holdYears = parseNum(answers.holdYears);
  const irrByYear =
    metricsIrrByYear ??
    calculateIRRByProjectionYear({
      initialCashInvested: cashInvested,
      baseAnnualIncome,
      baseAnnualOperatingExpenses: baseAnnualExpenses,
      annualDebtService: monthlyLoanPayment * 12,
      basePropertyValue: baseValue,
      startLoanBalance: startLoan,
      incomeGrowthPct,
      expenseGrowthPct,
      propertyGrowthPct: appreciationPct,
      monthlyLoanPayment,
      interestRateApr: ratePct,
      sellingCostPct,
      projectionYears: yearCols,
      holdingPeriodYears: holdYears,
      hasLoan: startLoan > 0
    });
  const irrByHorizon = irrByYear.map((row) => row.irr);
  const defaultIrr = irrVal ?? resolveDefaultIrr(irrByYear, holdYears);

  const twoPercentRule =
    purchasePrice != null && purchasePrice > 0 && monthlyIncome > 0
      ? Number(((monthlyIncome / purchasePrice) * 100).toFixed(2))
      : null;

  const fiftyPctExpenses = monthlyIncome * 0.5;
  const ruleCashFlow =
    monthlyIncome > 0 ? monthlyIncome - fiftyPctExpenses - monthlyLoanPayment : null;
  const meetsFiftyOperating = monthlyIncome > 0 ? monthlyOperating <= fiftyPctExpenses + 0.01 : null;

  const investmentRating = derivePdfInvestmentRating({
    monthlyGrossIncome: monthlyIncome,
    monthlyCashFlow,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyLoanPayment: monthlyLoanPayment > 0 ? monthlyLoanPayment : 0,
    grossYield,
    twoPercentRule,
    cashOnCashRoi: cashOnCash,
    internalRateOfReturn: defaultIrr,
    cashInvested,
    purchasePrice,
    meetsFiftyPercentOperating: meetsFiftyOperating,
    ruleCashFlow
  });

  const keyAssumptions: { label: string; value: string }[] = [
    {
      label: "Cash invested / deposit",
      value: cashInvested != null && cashInvested > 0 ? formatZar(cashInvested) : "—"
    },
    { label: "Annual rent growth", value: formatPct(incomeGrowthPct) },
    { label: "Expense growth", value: formatPct(expenseGrowthPct) },
    { label: "Property appreciation", value: formatPct(appreciationPct) }
  ];

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
      internalRateOfReturn: defaultIrr,
      cashOnCashRoi: cashInvested != null && cashInvested > 0 ? cashOnCash : null,
      capRate: parseNum(metrics.netYield),
      twoPercentRule,
      ltv
    },
    keyAssumptions,
    executiveSummary: buildExecutiveSummary(investmentRating),
    investmentRating,
    assumptions,
    expenseBreakdown,
    projection: {
      years: yearCols,
      rows: [
        { label: "Monthly gross rent", values: projMonthlyGross },
        { label: "Total annual income", values: projIncome },
        { label: "Total annual expenses", values: projExpenses },
        { label: "Net operating income", values: projNoi },
        { label: "Total annual cash flow", values: projCashFlow },
        { label: "Property value", values: projValue },
        { label: "Equity", values: projEquity },
        { label: "Loan balance", values: projLoan },
        { label: "Cash on cash ROI", values: projCoC },
        { label: "IRR", values: irrByHorizon }
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
      { label: "50% Operating Allowance", value: formatZar(fiftyPctExpenses) },
      { label: "Operating Expenses (excl. debt)", value: formatZar(monthlyOperating) },
      { label: "Debt Service", value: monthlyLoanPayment > 0 ? formatZar(monthlyLoanPayment) : "—" },
      {
        label: "Rule Cash Flow",
        value: ruleCashFlow != null && Number.isFinite(ruleCashFlow) ? formatZar(ruleCashFlow) : "—"
      },
      {
        label: "Result",
        value: fiftyPercentRuleResult(monthlyIncome, monthlyOperating, ruleCashFlow)
      },
      {
        label: "Operating costs vs gross rent",
        value:
          monthlyIncome > 0
            ? `Operating costs are ${formatPct((monthlyOperating / monthlyIncome) * 100)} of gross rent (debt service excluded).`
            : "—"
      }
    ]
  };
}
