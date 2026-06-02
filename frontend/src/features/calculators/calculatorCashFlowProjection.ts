import type { NormalizedCalcResult } from "./propertyTypeCalculations";

export const CALCULATOR_CASH_FLOW_PROJECTION_YEARS = 5;

export type CalculatorProjectionAssumptions = {
  annualIncomeGrowthPercentAnnual?: number;
  expenseGrowthPercentAnnual?: number;
};

export type FiveYearCashFlowProjection = {
  years: number[];
  cashFlows: number[];
  incomeGrowthPct: number;
  expenseGrowthPct: number;
  hasData: boolean;
};

function projectValue(base: number, annualPct: number, years: number): number {
  if (base <= 0) return 0;
  return base * Math.pow(1 + annualPct / 100, years);
}

/** Matches PDF assembly: income and operating expenses grow separately; debt service stays flat. */
export function buildFiveYearCashFlowProjection(opts: {
  metrics: NormalizedCalcResult | null;
  projectionAssumptions?: CalculatorProjectionAssumptions | null;
}): FiveYearCashFlowProjection {
  const incomeGrowthPct = opts.projectionAssumptions?.annualIncomeGrowthPercentAnnual ?? 6;
  const expenseGrowthPct = opts.projectionAssumptions?.expenseGrowthPercentAnnual ?? 6;
  const years = Array.from({ length: CALCULATOR_CASH_FLOW_PROJECTION_YEARS }, (_, i) => i + 1);

  const metrics = opts.metrics;
  const monthlyIncome = metrics?.monthlyIncome ?? null;
  const monthlyExpenses = metrics?.monthlyExpenses ?? null;
  const monthlyLoanPayment = metrics?.monthlyBondPayment ?? 0;

  if (monthlyIncome == null && monthlyExpenses == null && metrics?.projectedCashFlow == null) {
    return { years, cashFlows: [], incomeGrowthPct, expenseGrowthPct, hasData: false };
  }

  const monthlyOperating = Math.max(0, (monthlyExpenses ?? 0) - monthlyLoanPayment);
  const baseAnnualIncome = (monthlyIncome ?? 0) * 12;
  const baseAnnualExpenses = monthlyOperating * 12;
  const annualDebtService = monthlyLoanPayment * 12;

  const cashFlows = years.map((y) => {
    const income = projectValue(baseAnnualIncome, incomeGrowthPct, y);
    const expenses = projectValue(baseAnnualExpenses, expenseGrowthPct, y);
    return Math.round((income - expenses - annualDebtService) * 100) / 100;
  });

  return { years, cashFlows, incomeGrowthPct, expenseGrowthPct, hasData: true };
}
