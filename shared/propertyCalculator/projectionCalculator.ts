import { round2 } from "./financialMetrics";
import { projectLoanBalanceAfterYears } from "./loanProjection";

export const DEFAULT_PROJECTION_YEARS = [1, 2, 5, 10, 15, 20, 30] as const;
export const CALCULATOR_PROJECTION_YEARS = 5;

export function projectValue(base: number, annualPct: number | null, years: number): number | null {
  if (!(base > 0) || years < 0) return null;
  if (annualPct == null || !Number.isFinite(annualPct)) return round2(base);
  const result = base * Math.pow(1 + annualPct / 100, years);
  return Number.isFinite(result) ? round2(result) : null;
}

export function buildAnnualProjectionSeries(opts: {
  years: number[];
  baseAnnualIncome: number;
  baseAnnualOperatingExpenses: number;
  annualDebtService: number;
  basePropertyValue: number;
  startLoanBalance: number;
  incomeGrowthPct: number;
  expenseGrowthPct: number;
  propertyGrowthPct: number;
  projectLoanBalance?: (startBalance: number, monthlyPayment: number, ratePct: number | null, years: number) => number | null;
  monthlyLoanPayment: number;
  interestRateApr: number | null;
}): {
  projectedIncome: number[];
  projectedExpenses: number[];
  projectedAnnualDebtService: number[];
  projectedCashFlow: number[];
  projectedPropertyValue: number[];
  projectedLoanBalance: number[];
  projectedEquity: number[];
} {
  const {
    years,
    baseAnnualIncome,
    baseAnnualOperatingExpenses,
    annualDebtService,
    basePropertyValue,
    startLoanBalance,
    incomeGrowthPct,
    expenseGrowthPct,
    propertyGrowthPct,
    projectLoanBalance,
    monthlyLoanPayment,
    interestRateApr
  } = opts;

  const loanProjector = projectLoanBalance ?? projectLoanBalanceAfterYears;

  const projectedIncome = years.map((y) => projectValue(baseAnnualIncome, incomeGrowthPct, y) ?? 0);
  const projectedExpenses = years.map((y) => projectValue(baseAnnualOperatingExpenses, expenseGrowthPct, y) ?? 0);
  const projectedAnnualDebtService = years.map(() => round2(annualDebtService));
  const projectedCashFlow = years.map((y, i) => {
    const inc = projectedIncome[i] ?? 0;
    const exp = projectedExpenses[i] ?? 0;
    return round2(inc - exp - annualDebtService);
  });
  const projectedPropertyValue = years.map((y) => projectValue(basePropertyValue, propertyGrowthPct, y) ?? 0);
  const projectedLoanBalance = years.map((y) => {
    if (startLoanBalance <= 0) return 0;
    return loanProjector(startLoanBalance, monthlyLoanPayment, interestRateApr, y) ?? 0;
  });
  const projectedEquity = years.map((y, i) => {
    const value = projectedPropertyValue[i] ?? 0;
    const loan = projectedLoanBalance[i] ?? 0;
    return round2(value - loan);
  });

  return {
    projectedIncome,
    projectedExpenses,
    projectedAnnualDebtService,
    projectedCashFlow,
    projectedPropertyValue,
    projectedLoanBalance,
    projectedEquity
  };
}

export function buildFiveYearCashFlowFromMonthly(opts: {
  monthlyIncome: number | null;
  monthlyOperatingExpenses: number | null;
  monthlyLoanPayment: number | null;
  incomeGrowthPct?: number;
  expenseGrowthPct?: number;
}): { years: number[]; cashFlows: number[]; hasData: boolean } {
  const incomeGrowthPct = opts.incomeGrowthPct ?? 6;
  const expenseGrowthPct = opts.expenseGrowthPct ?? 6;
  const years = Array.from({ length: CALCULATOR_PROJECTION_YEARS }, (_, i) => i + 1);
  const monthlyIncome = opts.monthlyIncome;
  const monthlyLoanPayment = opts.monthlyLoanPayment ?? 0;
  const monthlyOperating = opts.monthlyOperatingExpenses ?? 0;

  if (monthlyIncome == null && monthlyOperating <= 0) {
    return { years, cashFlows: [], hasData: false };
  }

  const baseAnnualIncome = (monthlyIncome ?? 0) * 12;
  const baseAnnualExpenses = monthlyOperating * 12;
  const annualDebtService = monthlyLoanPayment * 12;

  const cashFlows = years.map((y) => {
    const income = projectValue(baseAnnualIncome, incomeGrowthPct, y) ?? 0;
    const expenses = projectValue(baseAnnualExpenses, expenseGrowthPct, y) ?? 0;
    return round2(income - expenses - annualDebtService);
  });

  return { years, cashFlows, hasData: true };
}
