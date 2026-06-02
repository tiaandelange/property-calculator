import { describe, expect, it } from "vitest";
import {
  buildPortfolioProjectionYears,
  pickPortfolioProjectionDisplayYears,
  PORTFOLIO_PROJECTION_DISPLAY_YEARS
} from "./portfolioProjectionUtils";

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
    expect(rows[0]?.irr).not.toBeNull();
    expect(Number.isFinite(rows[0]?.irr)).toBe(true);
    expect(rows[9]?.irr).not.toBeNull();
  });

  it("returns empty when no qualifying properties", () => {
    expect(buildPortfolioProjectionYears(null, [])).toEqual([]);
  });

  it("uses property list baselines when dashboard ledger expenses are inflated", () => {
    const data = {
      kpis: {
        portfolioAnalysisOverTime: {
          projectionGrowth: {
            rentalIncomeGrowthPercentAnnual: 0,
            totalExpensesGrowthPercentAnnual: 0
          },
          appreciationDefaultPercent: 0
        }
      },
      charts: {
        cashFlowByProperty: [
          {
            propertyId: "p1",
            monthlyIncome: 25_280,
            monthlyExpenses: 40_224,
            netCashFlow: -14_944
          }
        ]
      }
    };
    const properties = [
      {
        id: "p1",
        currentEstimatedValue: 3_000_000,
        outstandingBondBalance: 1_900_000,
        monthlyBondPayment: 17_600,
        monthlyIncome: 25_280,
        monthlyOperatingExpenses: 3_500,
        monthlyDebtService: 17_600,
        totalCashInvested: 500_000
      }
    ];
    const y1 = buildPortfolioProjectionYears(data, properties)[0];
    expect(y1?.income).toBe(25_280 * 12);
    expect(y1?.expenses).toBe((3_500 + 17_600) * 12);
    expect(y1?.cashFlow).toBe((25_280 - 3_500 - 17_600) * 12);
    expect(y1?.cashFlow).toBeGreaterThan(0);
  });

  it("pickPortfolioProjectionDisplayYears matches report horizons", () => {
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
        currentEstimatedValue: 1_000_000,
        expectedMonthlyIncome: 10_000,
        expectedMonthlyExpenses: 2_000,
        totalCashInvested: 200_000
      }
    ];
    const all = buildPortfolioProjectionYears(data, properties);
    const display = pickPortfolioProjectionDisplayYears(all);
    expect(display.map((r) => r.year)).toEqual([...PORTFOLIO_PROJECTION_DISPLAY_YEARS]);
  });
});
