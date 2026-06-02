import { describe, expect, it } from "vitest";
import type { NormalizedPropertyCalculatorInput } from "@propertyCalculator/calculatorTypes";
import { computeCashOnCashRoiPercent, safeDiv } from "@propertyCalculator/financialMetrics";
import { runPropertyCalculator } from "@propertyCalculator/propertyCalculatorEngine";

function baseInput(overrides: Partial<NormalizedPropertyCalculatorInput> = {}): NormalizedPropertyCalculatorInput {
  return {
    propertyType: "single-family",
    dataSource: "calculator-form",
    purchasePrice: 1_000_000,
    marketValue: 1_100_000,
    closingCosts: 50_000,
    repairsRenovation: 0,
    cashInvested: 300_000,
    loanAmount: 700_000,
    loanBalance: 700_000,
    interestRateApr: 10,
    loanTermYears: 20,
    monthlyLoanPayment: 6_758,
    monthlyRent: 10_000,
    unit1Rent: null,
    unit2Rent: null,
    unit1Occupied: true,
    unit2Occupied: true,
    numberOfUnits: null,
    averageRentPerUnit: null,
    bedsOrRooms: null,
    rentPerBed: null,
    nightlyRate: null,
    occupancyRatePct: null,
    bookedNightsPerMonth: null,
    cleaningIncome: null,
    monthlyLeaseIncome: null,
    cleaningCosts: null,
    platformFeesPct: null,
    ratesTaxesMonthly: 500,
    insuranceMonthly: 400,
    maintenanceMonthly: 300,
    managementFeePct: 8,
    leviesMonthly: 0,
    utilitiesMonthly: 0,
    otherExpensesMonthly: null,
    holdingCostsMonthly: null,
    vacancyAllowancePct: 5,
    annualRentGrowthPct: 6,
    annualExpenseGrowthPct: 6,
    annualPropertyGrowthPct: 5,
    holdingPeriodYears: 5,
    monthlyOperatingExpensesOverride: null,
    monthlyDebtServiceOverride: null,
    sellingCostPct: null,
    ...overrides
  };
}

describe("runPropertyCalculator", () => {
  it("single-family computes cash on cash without NaN", () => {
    const result = runPropertyCalculator(baseInput());
    expect(result.cashOnCashRoi).not.toBeNull();
    expect(Number.isFinite(result.cashOnCashRoi)).toBe(true);
    expect(result.grossYield).not.toBeNull();
    expect(result.monthlyCashFlow).not.toBeNull();
  });

  it("duplex sums unit rents", () => {
    const result = runPropertyCalculator(
      baseInput({
        propertyType: "duplex",
        monthlyRent: null,
        unit1Rent: 5_000,
        unit2Rent: 4_500,
        unit1Occupied: true,
        unit2Occupied: true
      })
    );
    expect(result.monthlyIncome).toBe(9_500);
  });

  it("multi-family uses units and occupancy", () => {
    const result = runPropertyCalculator(
      baseInput({
        propertyType: "multi-family",
        monthlyRent: null,
        numberOfUnits: 10,
        averageRentPerUnit: 6_000,
        occupancyRatePct: 90
      })
    );
    expect(result.monthlyIncome).toBe(54_000);
  });

  it("student housing uses beds and rent per bed", () => {
    const result = runPropertyCalculator(
      baseInput({
        propertyType: "student-housing",
        monthlyRent: null,
        bedsOrRooms: 20,
        rentPerBed: 4_000,
        occupancyRatePct: 95
      })
    );
    expect(result.monthlyIncome).toBe(76_000);
  });

  it("airbnb uses nightly rate and booked nights", () => {
    const result = runPropertyCalculator(
      baseInput({
        propertyType: "airbnb",
        monthlyRent: null,
        nightlyRate: 1_200,
        bookedNightsPerMonth: 18,
        cleaningIncome: 2_000,
        platformFeesPct: 15
      })
    );
    expect(result.monthlyIncome).toBe(23_600);
  });

  it("vacant land does not force rent", () => {
    const result = runPropertyCalculator(
      baseInput({
        propertyType: "vacant-land",
        monthlyRent: null,
        holdingCostsMonthly: 1_500,
        ratesTaxesMonthly: 800
      })
    );
    expect(result.monthlyIncome).toBeNull();
    expect(result.monthlyCashFlow).toBeLessThan(0);
  });

  it("zero cash invested returns null cash on cash", () => {
    expect(computeCashOnCashRoiPercent(12_000, 0)).toBeNull();
    const result = runPropertyCalculator(baseInput({ cashInvested: 0, closingCosts: 0, repairsRenovation: 0 }));
    expect(result.cashOnCashRoi).toBeNull();
  });

  it("zero loan amount yields null LTV", () => {
    const result = runPropertyCalculator(baseInput({ loanAmount: 0, loanBalance: 0, monthlyLoanPayment: 0 }));
    expect(result.ltv).toBeNull();
  });

  it("missing rent yields warnings and null yield", () => {
    const result = runPropertyCalculator(baseInput({ monthlyRent: null }));
    expect(result.grossYield).toBeNull();
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it("negative cash flow is finite", () => {
    const result = runPropertyCalculator(
      baseInput({ monthlyRent: 2_000, monthlyLoanPayment: 8_000, ratesTaxesMonthly: 2_000 })
    );
    expect(result.monthlyCashFlow).not.toBeNull();
    expect((result.monthlyCashFlow ?? 0) < 0).toBe(true);
    expect(Number.isNaN(result.monthlyCashFlow as number)).toBe(false);
  });

  it("safeDiv never returns Infinity", () => {
    expect(safeDiv(1, 0)).toBeNull();
  });
});
