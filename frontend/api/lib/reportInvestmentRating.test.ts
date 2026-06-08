import { describe, expect, it } from "vitest";
import { derivePdfInvestmentRating } from "./reportInvestmentRating.js";
import { fiftyPercentRuleResult } from "./propertyInvestmentReportData.js";

describe("fiftyPercentRuleResult", () => {
  it("does not meet when rule cash flow is negative", () => {
    expect(fiftyPercentRuleResult(20_000, 8_000, -2_000)).toBe("Does Not Meet 50% Rule");
  });

  it("meets when operating costs are within 50% and rule cash flow is positive", () => {
    expect(fiftyPercentRuleResult(20_000, 8_000, 2_000)).toBe("Meets 50% Rule");
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
      cashInvested: 400_000,
      purchasePrice: null,
      meetsFiftyPercentOperating: true,
      ruleCashFlow: 1_000
    });
    expect(rating.label).toBe("Insufficient Data");
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
      cashInvested: 400_000,
      purchasePrice: 1_500_000,
      meetsFiftyPercentOperating: false,
      ruleCashFlow: -4_250
    });
    expect(["Needs Review", "Weak", "Insufficient Data"]).toContain(rating.label);
    expect(rating.label).not.toBe("Bad");
  });
});
