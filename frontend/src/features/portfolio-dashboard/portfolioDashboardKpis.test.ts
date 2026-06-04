import { describe, expect, it } from "vitest";
import {
  aggregatePortfolioKpisFromProperties,
  parsePortfolioDashboardKpis,
  resolvePortfolioDashboardKpis
} from "./portfolioDashboardKpis";

describe("aggregatePortfolioKpisFromProperties", () => {
  it("sums Financials-tab fields: lease income, recurring opex, bond, NOI without bond", () => {
    const kpis = aggregatePortfolioKpisFromProperties([
      {
        monthlyIncome: 25_000,
        monthlyOperatingExpenses: 3_000,
        monthlyDebtService: 10_000,
        monthlyExpenses: 13_000,
        monthlyNOI: 22_000,
        netCashFlow: 12_000,
        currentEstimatedValue: 1_500_000,
        totalCashInvested: 800_000
      },
      {
        monthlyIncome: 17_000,
        monthlyOperatingExpenses: 2_000,
        monthlyDebtService: 5_000,
        monthlyExpenses: 7_000,
        monthlyNOI: 15_000,
        netCashFlow: 10_000,
        currentEstimatedValue: 900_000,
        totalCashInvested: 400_000
      }
    ]);

    expect(kpis.monthlyIncome).toBe(42_000);
    expect(kpis.monthlyOperatingExpenses).toBe(5_000);
    expect(kpis.monthlyDebtService).toBe(15_000);
    expect(kpis.monthlyExpenses).toBe(20_000);
    expect(kpis.monthlyNoi).toBe(37_000);
    expect(kpis.monthlyCashFlow).toBe(22_000);
    expect(kpis.cashOnCashAnnualPercent).toBeCloseTo(22, 5);
    expect(kpis.capRatePercent).toBeCloseTo((37_000 * 12) / 2_400_000 * 100, 5);
  });
});

describe("parsePortfolioDashboardKpis", () => {
  it("derives cash flow as lease income minus operating expenses and bond payments", () => {
    const kpis = parsePortfolioDashboardKpis({
      contractualMonthlyRentFromLeases: 50_000,
      totalMonthlyOperatingExpenses: 12_000,
      totalMonthlyDebtService: 8_000,
      charts: { valueDebtEquity: { totalCurrentEstimatedValue: 2_000_000 } },
      kpis: {
        monthlyNOI: { operatingIncomeProjectedFromLeases: 50_000 },
        trueCashOnCashROI: { totalCashInvested: 1_000_000, valuePercent: 99 }
      }
    });

    expect(kpis.monthlyIncome).toBe(50_000);
    expect(kpis.monthlyExpenses).toBe(20_000);
    expect(kpis.monthlyCashFlow).toBe(30_000);
    expect(kpis.monthlyNoi).toBe(38_000);
    expect(kpis.cashOnCashAnnualPercent).toBe(36);
  });

  it("falls back to contractual lease rent when no received income is recorded", () => {
    const kpis = parsePortfolioDashboardKpis({
      totalMonthlyIncome: 0,
      totalMonthlyIncomeReceived: 0,
      monthlyNetCashFlow: 0,
      contractualMonthlyRentFromLeases: 42_000,
      totalMonthlyOperatingExpenses: 5_000,
      totalMonthlyDebtService: 12_000,
      charts: { valueDebtEquity: { totalCurrentEstimatedValue: 3_000_000 } },
      kpis: {
        monthlyNOI: {
          operatingIncomeProjectedFromLeases: 42_000,
          contractualMonthlyRentFromLeases: 42_000
        },
        trueCashOnCashROI: { totalCashInvested: 2_100_000 }
      }
    });

    expect(kpis.monthlyIncome).toBe(42_000);
    expect(kpis.monthlyExpenses).toBe(17_000);
    expect(kpis.monthlyCashFlow).toBe(25_000);
    expect(kpis.cashOnCashAnnualPercent).toBeCloseTo(14.2857, 3);
  });

  it("computes cap rate from monthly NOI and market value", () => {
    const kpis = parsePortfolioDashboardKpis({
      contractualMonthlyRentFromLeases: 10_000,
      totalMonthlyOperatingExpenses: 2_000,
      totalMonthlyDebtService: 1_000,
      charts: { valueDebtEquity: { totalCurrentEstimatedValue: 1_200_000 } },
      kpis: { monthlyNOI: { operatingIncomeProjectedFromLeases: 10_000 } }
    });

    expect(kpis.capRatePercent).toBeCloseTo(8, 5);
  });
});

describe("resolvePortfolioDashboardKpis", () => {
  it("prefers property Financials aggregates over RPC summary", () => {
    const kpis = resolvePortfolioDashboardKpis(
      { totalMonthlyIncome: 0, monthlyNetCashFlow: 0 },
      [{ id: "a", monthlyIncome: 30_000, monthlyOperatingExpenses: 4_000, monthlyDebtService: 6_000, monthlyExpenses: 10_000, monthlyNOI: 26_000, netCashFlow: 20_000 }],
      { propertyId: "a" }
    );

    expect(kpis.monthlyIncome).toBe(30_000);
    expect(kpis.monthlyCashFlow).toBe(20_000);
  });
});
