/**
 * Shared monthly / annual financial assembly for Property Investment Report PDFs.
 */

import { computeCashOnCashRoiPercent } from "./propertyCalculator/financialMetrics.js";
import { projectLoanBalanceAfterYears, projectValue } from "./propertyCalculatorServer.js";
import { formatPdfPercent, formatPdfZar } from "./pdf/pdfFormat.js";

const PROJECTION_YEARS = [1, 2, 5, 10, 15, 20, 30] as const;

function formatZar(amount: number): string {
  return formatPdfZar(amount);
}

export type MonthlyFinancialSnapshot = {
  monthlyGrossIncome: number;
  effectiveMonthlyIncome: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  monthlyTotalOutflows: number;
  monthlyNoi: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
};

/** Prefer line-item operating sum; strip debt from metrics payload when double-counted. */
export function resolveOperatingExpenses(
  metricsExpenses: number,
  bondPayment: number,
  lineItemOperating: number
): number {
  if (lineItemOperating > 0) return lineItemOperating;
  if (bondPayment > 0 && metricsExpenses > bondPayment + 0.01) {
    return Math.max(0, metricsExpenses - bondPayment);
  }
  return Math.max(0, metricsExpenses);
}

export function computeMonthlyFinancials(opts: {
  monthlyGrossIncome: number;
  effectiveMonthlyIncome?: number;
  monthlyOperatingExpenses: number;
  monthlyDebtService: number;
  monthlyCashFlowOverride?: number | null;
}): MonthlyFinancialSnapshot {
  const effective = opts.effectiveMonthlyIncome ?? opts.monthlyGrossIncome;
  const operating = opts.monthlyOperatingExpenses;
  const debt = opts.monthlyDebtService;
  const totalOutflows = operating + debt;
  const noi = effective - operating;
  const cashFlow =
    opts.monthlyCashFlowOverride != null && Number.isFinite(opts.monthlyCashFlowOverride)
      ? opts.monthlyCashFlowOverride
      : noi - debt;
  return {
    monthlyGrossIncome: opts.monthlyGrossIncome,
    effectiveMonthlyIncome: effective,
    monthlyOperatingExpenses: operating,
    monthlyDebtService: debt,
    monthlyTotalOutflows: totalOutflows,
    monthlyNoi: noi,
    monthlyCashFlow: cashFlow,
    annualCashFlow: cashFlow * 12
  };
}

export function buildFiftyPercentBondRuleRows(
  monthlyGross: number,
  bondPayment: number
): { label: string; value: string }[] {
  const half = monthlyGross * 0.5;
  const surplus = half - bondPayment;
  const meets = monthlyGross > 0 && bondPayment > 0 && half > bondPayment;
  const shortfallAbs = Math.abs(surplus);
  const note =
    monthlyGross > 0 && bondPayment > 0
      ? meets
        ? `50% of monthly income is ${formatZar(half)}, which is ${formatZar(surplus)} above the monthly bond payment.`
        : `50% of monthly income is ${formatZar(half)}, which is ${formatZar(shortfallAbs)} below the monthly bond payment.`
      : "—";

  return [
    { label: "Monthly Income / Gross Rent", value: formatZar(monthlyGross) },
    { label: "50% of Monthly Income", value: formatZar(half) },
    { label: "Monthly Bond Payment", value: bondPayment > 0 ? formatZar(bondPayment) : "—" },
    {
      label: "Surplus / Shortfall",
      value: monthlyGross > 0 && bondPayment > 0 ? formatZar(surplus) : "—"
    },
    {
      label: "Result",
      value:
        monthlyGross <= 0 || bondPayment <= 0
          ? "Insufficient Data"
          : meets
            ? "Meets 50% Rule"
            : "Does Not Meet 50% Rule"
    },
    { label: "Note", value: note }
  ];
}

export const REPORT_PROJECTION_LABELS = {
  annualGrossRent: "Annual Gross Rent",
  effectiveAnnualIncome: "Effective Annual Income",
  annualOperatingExpenses: "Annual Operating Expenses",
  noi: "Net Operating Income",
  annualDebtService: "Annual Debt Service",
  cashFlowAfterDebt: "Cash Flow After Debt Service",
  propertyValue: "Property Value",
  loanBalance: "Loan Balance",
  equity: "Equity",
  cashOnCashRoi: "Cash-on-Cash ROI",
  irr: "IRR"
} as const;

export function buildAnnualProjectionRows(opts: {
  monthlyGrossIncome: number;
  effectiveMonthlyIncome: number;
  monthlyOperating: number;
  monthlyDebtService: number;
  incomeGrowthPct: number;
  expenseGrowthPct: number;
  appreciationPct: number;
  basePropertyValue: number;
  startLoan: number;
  monthlyLoanPayment: number;
  ratePct: number | null;
  totalCashInvested: number | null;
  irrByHorizon: (number | null)[];
  years?: number[];
}): { years: number[]; rows: { label: string; values: (number | null)[] }[] } {
  const yearCols = opts.years ?? [...PROJECTION_YEARS];
  const vacancyFactor =
    opts.monthlyGrossIncome > 0 ? opts.effectiveMonthlyIncome / opts.monthlyGrossIncome : 1;

  const baseAnnualGross = opts.monthlyGrossIncome * 12;
  const baseAnnualOperating = opts.monthlyOperating * 12;
  const annualDebt = opts.monthlyDebtService * 12;

  const projAnnualGross = yearCols.map((y) => projectValue(baseAnnualGross, opts.incomeGrowthPct, y));
  const projEffective = projAnnualGross.map((g) =>
    g == null ? null : Math.round(g * vacancyFactor + Number.EPSILON)
  );
  const projOperating = yearCols.map((y) =>
    projectValue(baseAnnualOperating, opts.expenseGrowthPct, y)
  );
  const projNoi = projEffective.map((inc, i) => {
    const op = projOperating[i];
    if (inc == null || op == null) return null;
    return inc - op;
  });
  const projDebt = yearCols.map(() => (annualDebt > 0 ? annualDebt : null));
  const projCashFlow = projNoi.map((noi, i) => {
    if (noi == null) return null;
    const debt = projDebt[i] ?? 0;
    return noi - debt;
  });
  const projValue = yearCols.map((y) => projectValue(opts.basePropertyValue, opts.appreciationPct, y));
  const projLoan = yearCols.map((y) =>
    opts.startLoan > 0
      ? projectLoanBalanceAfterYears(opts.startLoan, opts.monthlyLoanPayment, opts.ratePct, y)
      : 0
  );
  const projEquity = yearCols.map((_, i) => {
    const pv = projValue[i];
    const lb = projLoan[i];
    if (pv == null || lb == null) return null;
    return pv - lb;
  });
  const projCoC = projCashFlow.map((cf) =>
    cf == null || opts.totalCashInvested == null || opts.totalCashInvested <= 0
      ? null
      : computeCashOnCashRoiPercent(cf, opts.totalCashInvested)
  );

  const L = REPORT_PROJECTION_LABELS;
  return {
    years: yearCols,
    rows: [
      { label: L.annualGrossRent, values: projAnnualGross },
      { label: L.effectiveAnnualIncome, values: projEffective },
      { label: L.annualOperatingExpenses, values: projOperating },
      { label: L.noi, values: projNoi },
      { label: L.annualDebtService, values: projDebt },
      { label: L.cashFlowAfterDebt, values: projCashFlow },
      { label: L.propertyValue, values: projValue },
      { label: L.loanBalance, values: projLoan },
      { label: L.equity, values: projEquity },
      { label: L.cashOnCashRoi, values: projCoC },
      { label: L.irr, values: opts.irrByHorizon }
    ]
  };
}
