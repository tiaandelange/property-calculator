import { buildFiveYearCashFlowFromMonthly } from "@propertyCalculator/projectionCalculator";
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

/** Matches PDF assembly: income and operating expenses grow separately; debt service stays flat. */
export function buildFiveYearCashFlowProjection(opts: {
  metrics: NormalizedCalcResult | null;
  projectionAssumptions?: CalculatorProjectionAssumptions | null;
}): FiveYearCashFlowProjection {
  const incomeGrowthPct = opts.projectionAssumptions?.annualIncomeGrowthPercentAnnual ?? 6;
  const expenseGrowthPct = opts.projectionAssumptions?.expenseGrowthPercentAnnual ?? 6;
  const metrics = opts.metrics;
  const monthlyIncome = metrics?.monthlyIncome ?? null;
  const monthlyExpenses = metrics?.monthlyExpenses ?? null;
  const monthlyLoanPayment = metrics?.monthlyBondPayment ?? 0;
  const monthlyOperating = Math.max(0, (monthlyExpenses ?? 0) - monthlyLoanPayment);

  const built = buildFiveYearCashFlowFromMonthly({
    monthlyIncome,
    monthlyOperatingExpenses: monthlyOperating,
    monthlyLoanPayment,
    incomeGrowthPct,
    expenseGrowthPct
  });

  return {
    years: built.years,
    cashFlows: built.cashFlows,
    incomeGrowthPct,
    expenseGrowthPct,
    hasData: built.hasData
  };
}
