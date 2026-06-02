import { describe, expect, it } from "vitest";
import {
  calculateIRR,
  calculateIRRByProjectionYear,
  irrPercent
} from "@propertyCalculator/irrCalculator";

describe("calculateIRR", () => {
  it("returns IRR for positive investment with exit", () => {
    const irr = calculateIRR([-100_000, 5_000, 5_000, 125_000]);
    expect(irr).not.toBeNull();
    expect(Number(irr)).toBeGreaterThan(10.5);
    expect(Number(irr)).toBeLessThan(11.1);
  });

  it("returns null for zero initial outlay", () => {
    expect(calculateIRR([0, 5_000])).toBeNull();
  });

  it("returns null when all cash flows are negative", () => {
    expect(calculateIRR([-100_000, -5_000, -5_000])).toBeNull();
  });

  it("returns null when all cash flows are positive", () => {
    expect(calculateIRR([5_000, 10_000])).toBeNull();
  });

  it("never returns NaN or Infinity", () => {
    const irr = calculateIRR([-50_000, 12_000, 45_000]);
    if (irr != null) {
      expect(Number.isFinite(irr)).toBe(true);
    }
  });

  it("irrPercent matches legacy API shape", () => {
    expect(irrPercent(100_000, [5_000, 5_000, 125_000])).not.toBeNull();
  });
});

describe("calculateIRRByProjectionYear", () => {
  const base = {
    initialCashInvested: 300_000,
    baseAnnualIncome: 120_000,
    baseAnnualOperatingExpenses: 36_000,
    annualDebtService: 81_096,
    basePropertyValue: 1_000_000,
    startLoanBalance: 700_000,
    incomeGrowthPct: 6,
    expenseGrowthPct: 6,
    propertyGrowthPct: 5,
    monthlyLoanPayment: 6_758,
    interestRateApr: 10,
    sellingCostPct: 0,
    projectionYears: [1, 2, 5, 10, 15, 20, 30],
    hasLoan: true
  };

  it("generates IRR for years 1,2,5,10,15,20,30", () => {
    const rows = calculateIRRByProjectionYear(base);
    expect(rows.map((r) => r.year)).toEqual([1, 2, 5, 10, 15, 20, 30]);
    expect(rows.every((r) => r.cashFlows.length >= 2)).toBe(true);
  });

  it("returns null IRR when cash invested missing", () => {
    const rows = calculateIRRByProjectionYear({ ...base, initialCashInvested: null });
    expect(rows.every((r) => r.irr == null)).toBe(true);
  });

  it("vacant land with holding costs can produce IRR", () => {
    const rows = calculateIRRByProjectionYear({
      ...base,
      baseAnnualIncome: 0,
      baseAnnualOperatingExpenses: 18_000,
      annualDebtService: 0,
      startLoanBalance: 0,
      hasLoan: false,
      basePropertyValue: 500_000,
      initialCashInvested: 100_000
    });
    const year5 = rows.find((r) => r.year === 5);
    expect(year5?.exitValue).not.toBeNull();
  });
});
