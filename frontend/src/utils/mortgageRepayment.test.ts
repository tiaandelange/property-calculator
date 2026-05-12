import { describe, expect, it } from "vitest";
import {
  HUB_MORTGAGE_PRICE_MAX,
  HUB_MORTGAGE_PRICE_MIN,
  monthlyBondRepayment,
  mortgageYearlySeries,
  remainingBalanceAfterPayments,
  snapPriceToStep
} from "./mortgageRepayment";

describe("snapPriceToStep", () => {
  it("snaps to 100k grid within bounds", () => {
    expect(snapPriceToStep(555_000)).toBe(600_000);
    expect(snapPriceToStep(499_000)).toBe(HUB_MORTGAGE_PRICE_MIN);
    expect(snapPriceToStep(5_200_000)).toBe(HUB_MORTGAGE_PRICE_MAX);
  });
});

describe("monthlyBondRepayment", () => {
  it("matches a known ballpark for a 20y loan", () => {
    const principal = 1_125_000;
    const pmt = monthlyBondRepayment(principal, 11.25, 20);
    expect(pmt).toBeGreaterThan(11_000);
    expect(pmt).toBeLessThan(13_000);
  });

  it("is linear for zero rate", () => {
    expect(monthlyBondRepayment(1_200_000, 0, 10)).toBe(10_000);
  });
});

describe("remainingBalanceAfterPayments", () => {
  it("starts at full principal and ends near zero", () => {
    const p = 1_000_000;
    const r = 10;
    const y = 20;
    expect(remainingBalanceAfterPayments(p, r, y, 0)).toBeCloseTo(p, -1);
    const n = y * 12;
    expect(remainingBalanceAfterPayments(p, r, y, n)).toBeLessThan(1);
  });
});

describe("mortgageYearlySeries", () => {
  it("has monotonic balance and paid", () => {
    const s = mortgageYearlySeries(900_000, 11.5, 15);
    expect(s[0].balance).toBeGreaterThan(s[s.length - 1].balance);
    expect(s[s.length - 1].totalPaid).toBeGreaterThan(s[0].totalPaid);
  });
});
