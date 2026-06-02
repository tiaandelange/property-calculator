import { describe, expect, it } from "vitest";
import { calculateIRRByProjectionYear, irrPercent } from "./propertyCalculatorServer";

describe("propertyCalculator.server bundle", () => {
  it("loads bundled IRR helpers (Vercel serverless entry surface)", () => {
    const irr = irrPercent(100_000, [5_000, 5_000, 125_000]);
    expect(irr).not.toBeNull();
    expect(Number.isFinite(irr!)).toBe(true);

    const byYear = calculateIRRByProjectionYear({
      initialCashInvested: 100_000,
      baseAnnualIncome: 120_000,
      baseAnnualOperatingExpenses: 40_000,
      annualDebtService: 60_000,
      basePropertyValue: 1_000_000,
      startLoanBalance: 800_000,
      incomeGrowthPct: 5,
      expenseGrowthPct: 5,
      propertyGrowthPct: 5,
      monthlyLoanPayment: 5_000,
      interestRateApr: 10,
      sellingCostPct: 5,
      projectionYears: [1, 5, 10],
      hasLoan: true
    });
    expect(byYear.length).toBe(3);
    expect(byYear[0]?.year).toBe(1);
  });
});
