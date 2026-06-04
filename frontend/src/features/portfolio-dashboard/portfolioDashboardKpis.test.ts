import { describe, expect, it } from "vitest";
import { parsePortfolioDashboardKpis } from "./portfolioDashboardKpis";

describe("parsePortfolioDashboardKpis", () => {
  it("derives cash flow as income minus operating expenses and bond payments", () => {
    const kpis = parsePortfolioDashboardKpis({
      totalMonthlyIncome: 50_000,
      totalMonthlyOperatingExpenses: 12_000,
      totalMonthlyDebtService: 8_000,
      monthlyNetCashFlow: 30_000,
      charts: { valueDebtEquity: { totalCurrentEstimatedValue: 2_000_000 } },
      kpis: {
        trueCashOnCashROI: { totalCashInvested: 1_000_000, valuePercent: 99 }
      }
    });

    expect(kpis.monthlyExpenses).toBe(20_000);
    expect(kpis.monthlyCashFlow).toBe(30_000);
    expect(kpis.monthlyNoi).toBe(38_000);
    expect(kpis.cashOnCashAnnualPercent).toBe(36);
  });

  it("computes cap rate from monthly NOI and market value", () => {
    const kpis = parsePortfolioDashboardKpis({
      totalMonthlyIncome: 10_000,
      totalMonthlyOperatingExpenses: 2_000,
      totalMonthlyDebtService: 1_000,
      charts: { valueDebtEquity: { totalCurrentEstimatedValue: 1_200_000 } },
      kpis: { monthlyNOI: { value: 8000 } }
    });

    expect(kpis.capRatePercent).toBeCloseTo(8, 5);
  });
});
