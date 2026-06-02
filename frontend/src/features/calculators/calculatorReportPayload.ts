import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";
import type { NormalizedCalcResult } from "./propertyTypeCalculations";

export type CalculatorReportChartData =
  | { kind: "incomeVsExpensesMonthly"; income: number | null; expenses: number | null }
  | { kind: "cashFlowTrendMonthly"; points: Array<{ month: number; cashFlow: number }> };

export type CalculatorReportPayload = {
  version: 1;
  createdAt: string;
  propertyType: PropertyTypeId;
  answers: Record<string, string>;
  metrics: NormalizedCalcResult;
  charts: CalculatorReportChartData[];
};

export function buildCalculatorReportPayload(opts: {
  propertyType: PropertyTypeId;
  answers: Record<string, string>;
  metrics: NormalizedCalcResult;
}): CalculatorReportPayload {
  const { propertyType, answers, metrics } = opts;
  const charts: CalculatorReportChartData[] = [
    { kind: "incomeVsExpensesMonthly", income: metrics.monthlyIncome, expenses: metrics.monthlyExpenses }
  ];

  if (metrics.projectedCashFlow != null) {
    charts.push({
      kind: "cashFlowTrendMonthly",
      points: Array.from({ length: 12 }).map((_, i) => ({ month: i + 1, cashFlow: metrics.projectedCashFlow ?? 0 }))
    });
  } else {
    charts.push({ kind: "cashFlowTrendMonthly", points: [] });
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    propertyType,
    answers,
    metrics,
    charts
  };
}

