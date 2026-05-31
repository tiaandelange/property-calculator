import { describe, expect, it } from "vitest";
import {
  computeCashOnCashRoiPercent,
  computeEquity,
  computeGrossYieldPercent,
  resolveCashInvested
} from "./financialCalculations";
import { buildPropertyFinancialSummary } from "./buildPropertyFinancialSummary";

describe("financialCalculations", () => {
  it("computes equity from market value and loan balance", () => {
    expect(computeEquity(2_000_000, 1_200_000)).toBe(800_000);
    expect(computeEquity(null, 1_000)).toBeNull();
  });

  it("returns null cash on cash when cash invested is missing or zero", () => {
    expect(computeCashOnCashRoiPercent(5_000, null)).toBeNull();
    expect(computeCashOnCashRoiPercent(5_000, 0)).toBeNull();
  });

  it("computes cash on cash ROI from monthly cash flow", () => {
    expect(computeCashOnCashRoiPercent(5_000, 500_000)).toBe(12);
  });

  it("shows zero percent cash on cash when cash flow is zero", () => {
    expect(computeCashOnCashRoiPercent(0, 500_000)).toBe(0);
  });

  it("resolves cash invested from totalCashInvested", () => {
    expect(resolveCashInvested({ totalCashInvested: 250_000 })).toBe(250_000);
    expect(resolveCashInvested({ totalCashInvested: 0 })).toBeNull();
  });

  it("computes gross yield on purchase price", () => {
    expect(computeGrossYieldPercent(10_000, 1_200_000)).toBe(10);
  });
});

describe("buildPropertyFinancialSummary", () => {
  it("matches overview and financials cash on cash from the same inputs", () => {
    const summary = buildPropertyFinancialSummary({
      propertyId: "p1",
      propertyDetail: {
        name: "Oak",
        purchasePrice: 1_200_000,
        currentEstimatedValue: 1_500_000,
        outstandingBondBalance: 900_000,
        totalCashInvested: 400_000,
        expectedMonthlyExpenses: 2_000,
        activeUnitCount: 1
      },
      currentLeases: [{ status: "ACTIVE", monthlyRent: 12_000 }],
      recurringChargesLandlord: [{ category: "LEVIES", amount: 1_500, recurringFrequency: "MONTHLY" }],
      statement: null,
      deposits: [],
      additionalBondMonthlyTotal: 0
    });

    expect(summary.monthlyIncome).toBe(12_000);
    expect(summary.monthlyOperatingExpenses).toBe(1_500);
    expect(summary.equity).toBe(600_000);
    expect(summary.cashOnCashRoi).not.toBeNull();
    expect(summary.grossYield).toBe(12);
    expect(summary.overview.netCashFlow).toBe(summary.monthlyCashFlow);
    expect(summary.cashOnCashRoi).toBe(
      computeCashOnCashRoiPercent(summary.monthlyCashFlow, resolveCashInvested({ totalCashInvested: 400_000 }))
    );
  });
});
