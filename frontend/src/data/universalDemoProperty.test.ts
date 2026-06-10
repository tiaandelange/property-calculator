import { describe, expect, it } from "vitest";
import { calculate } from "@calculatorShared/calculatorEngine";
import {
  UNIVERSAL_DEMO_PROPERTY,
  buildUniversalCalculatorDefaults,
  deriveUniversalDemoMetrics
} from "@calculatorShared/universalDemoProperty";
import {
  calculateBondInitiationFeeExVat,
  calculateTransferDutySA,
  estimateLssaConveyancingFeeExVat
} from "@calculatorShared/saTransferBondCosts";
import { calculators } from "../data/calculators";

describe("universalDemoProperty", () => {
  it("uses R2.3M purchase and 10.5% interest consistently", () => {
    expect(UNIVERSAL_DEMO_PROPERTY.purchasePrice).toBe(2_300_000);
    expect(UNIVERSAL_DEMO_PROPERTY.annualInterestRatePercent).toBe(10.5);
    const monthly = buildUniversalCalculatorDefaults("monthly-payment") as {
      purchasePrice: number;
      annualInterestRate: number;
    };
    expect(monthly.purchasePrice).toBe(2_300_000);
    expect(monthly.annualInterestRate).toBe(10.5);
  });

  it("derives bond payment and NOI from the same income/expense stack", () => {
    const d = deriveUniversalDemoMetrics();
    expect(d.monthlyBondPayment).toBeGreaterThan(0);
    expect(d.noi.noiAnnual).toBeGreaterThan(0);
    expect(buildUniversalCalculatorDefaults("cash-flow")).toMatchObject({
      monthlyRent: UNIVERSAL_DEMO_PROPERTY.monthlyRent,
      bondAmount: UNIVERSAL_DEMO_PROPERTY.loanAmount,
      annualInterestRate: UNIVERSAL_DEMO_PROPERTY.annualInterestRatePercent,
      loanTermYears: UNIVERSAL_DEMO_PROPERTY.loanTermYears
    });
  });

  it("keeps operating costs near R3,200/mo and pre-tax cash flow positive", () => {
    const d = deriveUniversalDemoMetrics();
    expect(d.monthlyOperatingExpenses).toBeGreaterThanOrEqual(3_100);
    expect(d.monthlyOperatingExpenses).toBeLessThanOrEqual(3_300);
    expect(d.annualPreTaxCashFlow).toBeGreaterThan(0);

    const cf = calculate("cash-flow", buildUniversalCalculatorDefaults("cash-flow"));
    const monthlyCashFlow = cf.summary.find((m) => m.key === "monthlyCashFlow");
    expect(monthlyCashFlow?.value).toBeGreaterThan(0);
  });

  it("cash-on-cash-return exposes dual-axis cash flow chart and cash invested pie", () => {
    const result = calculate("cash-on-cash-return", buildUniversalCalculatorDefaults("cash-on-cash-return"));
    expect(result.chartData?.[0]?.chartType).toBe("combo");
    expect(result.chartData?.[0]?.data?.datasets).toHaveLength(2);
    expect(result.chartData?.[1]?.chartType).toBe("doughnut");
    expect((result.chartData?.[1]?.data?.labels ?? []).length).toBeGreaterThan(0);
  });

  it("provides defaults for every public calculator slug", () => {
    for (const calc of calculators) {
      const defaults = buildUniversalCalculatorDefaults(calc.slug);
      expect(Object.keys(defaults).length, calc.slug).toBeGreaterThan(0);
    }
  });
});

describe("SA cost formulas", () => {
  it("calculates transfer duty on R2.3M", () => {
    expect(calculateTransferDutySA(2_300_000, "TRANSFER_DUTY")).toBe(51_786);
  });

  it("uses LSSA conveyancing scale at R2.3M", () => {
    expect(estimateLssaConveyancingFeeExVat(2_300_000)).toBe(39_720);
  });

  it("caps bond initiation fee per NCR", () => {
    expect(calculateBondInitiationFeeExVat(1_840_000)).toBe(5_250);
  });
});

describe("screening calculators", () => {
  it("runs gross-yield and break-even-occupancy with universal defaults", () => {
    const gross = calculate("gross-yield", buildUniversalCalculatorDefaults("gross-yield"));
    expect(gross.summary.some((m) => m.key === "grossYield")).toBe(true);

    const be = calculate("break-even-occupancy", buildUniversalCalculatorDefaults("break-even-occupancy"));
    expect(be.summary.some((m) => m.key === "breakEvenOccupancy")).toBe(true);
  });
});
