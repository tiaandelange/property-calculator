import { describe, expect, it } from "vitest";
import { computeCashOnCashRoiPercent, resolveTotalCashInvested } from "./propertyCalculator/financialMetrics.js";

describe("resolveTotalCashInvested", () => {
  it("sums closing costs when deposit is zero", () => {
    const resolved = resolveTotalCashInvested({
      depositPayment: 0,
      closingCosts: 80_000
    });
    expect(resolved.totalCashInvested).toBe(80_000);
  });

  it("sums deposit and closing costs", () => {
    const resolved = resolveTotalCashInvested({
      depositPayment: 400_000,
      closingCosts: 50_000,
      repairsRenovation: 25_000
    });
    expect(resolved.totalCashInvested).toBe(475_000);
  });

  it("returns null when no upfront cash is recorded", () => {
    const resolved = resolveTotalCashInvested({ depositPayment: 0 });
    expect(resolved.totalCashInvested).toBeNull();
  });
});

describe("cash-on-cash ROI with total cash invested", () => {
  it("calculates ~57.63% for R0 deposit and R80k closing with R3,842 monthly cash flow", () => {
    const annualCashFlow = 3_842 * 12;
    const coc = computeCashOnCashRoiPercent(annualCashFlow, 80_000);
    expect(coc).not.toBeNull();
    expect(coc!).toBeGreaterThan(57.5);
    expect(coc!).toBeLessThan(57.8);
  });
});
