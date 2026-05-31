import { describe, expect, it } from "vitest";
import {
  computePropertyMonthlyFinancialSnapshot,
  propertyListCardFinancials
} from "./propertyFinancialsAdapter";

describe("computePropertyMonthlyFinancialSnapshot", () => {
  it("uses active lease rent for income when present", () => {
    const snap = computePropertyMonthlyFinancialSnapshot({
      property: { id: "p1", name: "Oak", expectedMonthlyIncome: 5_000 },
      currentLeases: [{ status: "ACTIVE", monthlyRent: 12_000 }]
    });
    expect(snap.monthlyIncome).toBe(12_000);
    expect(snap.combinedMonthlyLeaseRent).toBe(12_000);
  });

  it("falls back to expected monthly income without leases", () => {
    const snap = computePropertyMonthlyFinancialSnapshot({
      property: { id: "p1", name: "Oak", expectedMonthlyIncome: 8_500 },
      currentLeases: []
    });
    expect(snap.monthlyIncome).toBe(8_500);
  });

  it("sums recurring templates for operating expenses and excludes bond from NOI", () => {
    const snap = computePropertyMonthlyFinancialSnapshot({
      property: {
        id: "p1",
        name: "Oak",
        expectedMonthlyIncome: 10_000,
        bondAnnualInterestRatePercent: 10,
        bondTermYears: 20,
        bondStartDate: "2020-01-01",
        outstandingBondBalance: 1_000_000
      },
      currentLeases: [],
      recurringCharges: [
        { category: "LEVIES", amount: 1_200, recurringFrequency: "MONTHLY" },
        { category: "INSURANCE", amount: 600, recurringFrequency: "MONTHLY" }
      ]
    });
    expect(snap.monthlyOperatingExpenses).toBe(1_800);
    expect(snap.monthlyDebtService).toBeGreaterThan(0);
    expect(snap.monthlyNOI).toBe(10_000 - 1_800);
    expect(snap.netCashFlow).toBeLessThan(snap.monthlyNOI);
  });
});

describe("propertyListCardFinancials", () => {
  it("computes NOI as income minus operating expenses only", () => {
    const fin = propertyListCardFinancials({
      monthlyIncome: 12_000,
      monthlyOperatingExpenses: 2_500,
      monthlyDebtService: 4_000
    });
    expect(fin.monthlyNOI).toBe(9_500);
    expect(fin.monthlyCashFlow).toBe(5_500);
  });

  it("ignores stale monthlyNOI and netCashFlow fields on the payload", () => {
    const fin = propertyListCardFinancials({
      monthlyIncome: 10_000,
      monthlyOperatingExpenses: 1_800,
      monthlyDebtService: 3_000,
      monthlyNOI: 6_200,
      netCashFlow: 6_200
    });
    expect(fin.monthlyNOI).toBe(8_200);
    expect(fin.monthlyCashFlow).toBe(5_200);
  });

  it("derives bond payment for cash flow when debt service is missing on the card payload", () => {
    const fin = propertyListCardFinancials({
      name: "Oak",
      monthlyIncome: 10_000,
      monthlyOperatingExpenses: 1_800,
      monthlyDebtService: 0,
      bondAnnualInterestRatePercent: 10,
      bondTermYears: 20,
      bondStartDate: "2020-01-01",
      outstandingBondBalance: 1_000_000
    });
    expect(fin.monthlyNOI).toBe(8_200);
    expect(fin.monthlyDebtService).toBeGreaterThan(0);
    expect(fin.monthlyCashFlow).toBe(fin.monthlyNOI - fin.monthlyDebtService);
    expect(fin.monthlyCashFlow).toBeLessThan(fin.monthlyNOI);
  });
});
