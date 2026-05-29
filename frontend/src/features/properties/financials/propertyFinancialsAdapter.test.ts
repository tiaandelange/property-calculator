import { describe, expect, it } from "vitest";
import { computePropertyMonthlyFinancialSnapshot } from "./propertyFinancialsAdapter";

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
