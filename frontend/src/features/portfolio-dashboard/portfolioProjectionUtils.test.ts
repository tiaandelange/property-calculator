import { describe, expect, it } from "vitest";
import { buildPortfolioProjectionYears } from "./portfolioProjectionUtils";

describe("buildPortfolioProjectionYears", () => {
  it("returns 30 years when properties have baseline financials", () => {
    const data = {
      kpis: {
        portfolioAnalysisOverTime: {
          projectionGrowth: {
            rentalIncomeGrowthPercentAnnual: 5,
            totalExpensesGrowthPercentAnnual: 4
          },
          appreciationDefaultPercent: 5
        }
      },
      charts: { cashFlowByProperty: [] }
    };
    const properties = [
      {
        id: "p1",
        currentEstimatedValue: 2_000_000,
        outstandingBondBalance: 1_200_000,
        expectedMonthlyIncome: 18_000,
        expectedMonthlyExpenses: 4_000,
        totalCashInvested: 500_000,
        expectedAnnualAppreciationPercent: 5,
        estimatedSellingCostPercent: 5
      }
    ];
    const rows = buildPortfolioProjectionYears(data, properties);
    expect(rows).toHaveLength(30);
    expect(rows[0]?.year).toBe(1);
    expect(rows[29]?.year).toBe(30);
    expect(rows[0]?.income).toBeGreaterThan(0);
    expect(rows[0]?.equity).toBeGreaterThan(0);
  });

  it("returns empty when no qualifying properties", () => {
    expect(buildPortfolioProjectionYears(null, [])).toEqual([]);
  });
});
