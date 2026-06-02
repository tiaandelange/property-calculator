import { describe, expect, it } from "vitest";
import { buildFiveYearCashFlowProjection } from "./calculatorCashFlowProjection";
import type { NormalizedCalcResult } from "./propertyTypeCalculations";

const baseMetrics: NormalizedCalcResult = {
  monthlyIncome: 10_000,
  monthlyExpenses: 4_000,
  projectedCashFlow: 6_000,
  annualCashFlow: 72_000,
  grossYield: 8,
  netYield: 6,
  cashOnCashRoi: 10,
  internalRateofReturn: 12,
  ltv: 70,
  unitsOccupied: { occupied: 1, total: 1 },
  monthlyBondPayment: null
};

describe("buildFiveYearCashFlowProjection", () => {
  it("projects annual cash flow for 5 years with separate income and expense growth", () => {
    const out = buildFiveYearCashFlowProjection({
      metrics: baseMetrics,
      projectionAssumptions: {
        annualIncomeGrowthPercentAnnual: 6,
        expenseGrowthPercentAnnual: 4
      }
    });

    expect(out.years).toEqual([1, 2, 3, 4, 5]);
    expect(out.cashFlows).toHaveLength(5);
    expect(out.cashFlows[0]).toBe(77_280);
    expect(out.cashFlows[1]).toBeGreaterThan(out.cashFlows[0]);
    expect(out.cashFlows[4]).toBeGreaterThan(out.cashFlows[3]);
  });

  it("returns empty series when metrics are missing", () => {
    const out = buildFiveYearCashFlowProjection({ metrics: null });
    expect(out.hasData).toBe(false);
    expect(out.cashFlows).toEqual([]);
  });
});
