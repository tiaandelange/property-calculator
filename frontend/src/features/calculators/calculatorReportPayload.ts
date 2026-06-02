import type { PropertyTypeId } from "../../data/calculatorPropertyTypes";
import { buildFiveYearCashFlowProjection, type CalculatorProjectionAssumptions } from "./calculatorCashFlowProjection";
import type { NormalizedCalcResult } from "./propertyTypeCalculations";

export type CalculatorReportChartData =
  | { kind: "incomeVsExpensesMonthly"; income: number | null; expenses: number | null }
  | {
      kind: "cashFlowTrendYearly";
      points: Array<{ year: number; cashFlow: number }>;
      incomeGrowthPct: number;
      expenseGrowthPct: number;
    };

export type CalculatorReportPayload = {
  version: 1;
  createdAt: string;
  propertyType: PropertyTypeId;
  answers: Record<string, string>;
  metrics: NormalizedCalcResult;
  projectionAssumptions?: CalculatorProjectionAssumptions;
  charts: CalculatorReportChartData[];
};

export function buildCalculatorReportPayload(opts: {
  propertyType: PropertyTypeId;
  answers: Record<string, string>;
  metrics: NormalizedCalcResult;
  projectionAssumptions?: CalculatorProjectionAssumptions;
}): CalculatorReportPayload {
  const { propertyType, answers, metrics, projectionAssumptions } = opts;
  const charts: CalculatorReportChartData[] = [
    { kind: "incomeVsExpensesMonthly", income: metrics.monthlyIncome, expenses: metrics.monthlyExpenses }
  ];

  const cashFlowProjection = buildFiveYearCashFlowProjection({ metrics, projectionAssumptions });
  if (cashFlowProjection.hasData) {
    charts.push({
      kind: "cashFlowTrendYearly",
      points: cashFlowProjection.years.map((year, i) => ({
        year,
        cashFlow: cashFlowProjection.cashFlows[i] ?? 0
      })),
      incomeGrowthPct: cashFlowProjection.incomeGrowthPct,
      expenseGrowthPct: cashFlowProjection.expenseGrowthPct
    });
  } else {
    charts.push({
      kind: "cashFlowTrendYearly",
      points: [],
      incomeGrowthPct: cashFlowProjection.incomeGrowthPct,
      expenseGrowthPct: cashFlowProjection.expenseGrowthPct
    });
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    propertyType,
    answers,
    metrics,
    projectionAssumptions,
    charts
  };
}

