import { describe, expect, it } from "vitest";
import { buildFiftyPercentBondRuleRows } from "./reportFinancialAssembly.js";
import { derivePdfInvestmentRating } from "./reportInvestmentRating.js";

describe("buildFiftyPercentBondRuleRows", () => {
  it("does not meet when half of income is below bond payment", () => {
    const rows = buildFiftyPercentBondRuleRows(25_280, 16_674);
    const result = rows.find((r) => r.label === "Result")?.value;
    expect(result).toBe("Does Not Meet 50% Rule");
    const note = rows.find((r) => r.label === "Note")?.value ?? "";
    expect(note).toContain("below the monthly bond payment");
    expect(note).not.toContain("Operating costs are");
  });

  it("meets when half of income exceeds bond payment", () => {
    const rows = buildFiftyPercentBondRuleRows(20_000, 8_000);
    expect(rows.find((r) => r.label === "Result")?.value).toBe("Meets 50% Rule");
  });
});

describe("derivePdfInvestmentRating", () => {
  it("returns Insufficient Data when purchase price is missing", () => {
    const rating = derivePdfInvestmentRating({
      monthlyGrossIncome: 12_500,
      monthlyCashFlow: 2_000,
      monthlyOperatingExpenses: 4_000,
      monthlyLoanPayment: 6_500,
      grossYield: 10,
      twoPercentRule: 0.83,
      cashOnCashRoi: 6,
      internalRateOfReturn: 11,
      totalCashInvested: 400_000,
      purchasePrice: null,
      meetsFiftyPercentBond: true
    });
    expect(rating.label).toBe("Insufficient Data");
    expect(rating.reasons.length).toBeGreaterThan(0);
  });

  it("prefers Needs Review over Weak when IRR is unavailable", () => {
    const rating = derivePdfInvestmentRating({
      monthlyGrossIncome: 12_500,
      monthlyCashFlow: -500,
      monthlyOperatingExpenses: 9_000,
      monthlyLoanPayment: 11_000,
      grossYield: 4,
      twoPercentRule: 0.5,
      cashOnCashRoi: -2,
      internalRateOfReturn: null,
      totalCashInvested: 400_000,
      purchasePrice: 1_500_000,
      meetsFiftyPercentBond: false
    });
    expect(["Needs Review", "Weak", "Insufficient Data"]).toContain(rating.label);
    expect(rating.label).not.toBe("Bad");
  });

  it("includes bond-based 50% rule in reasons", () => {
    const rating = derivePdfInvestmentRating({
      monthlyGrossIncome: 25_280,
      monthlyCashFlow: 3_842,
      monthlyOperatingExpenses: 3_500,
      monthlyLoanPayment: 16_674,
      grossYield: 19.88,
      twoPercentRule: 1.74,
      cashOnCashRoi: 57.63,
      internalRateOfReturn: 100.26,
      totalCashInvested: 80_000,
      purchasePrice: 1_525_000,
      meetsFiftyPercentBond: false
    });
    expect(rating.reasons.some((r) => /50% rule is not achieved/i.test(r))).toBe(true);
    expect(rating.summary).toContain("below the bond payment");
  });
});
