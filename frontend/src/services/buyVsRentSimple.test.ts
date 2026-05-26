import { describe, expect, it } from "vitest";
import {
  mapSimpleBuyVsRentToCalculatorResult,
  runSimpleBuyVsRentCalculator
} from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentCalculator";
import { generateSimpleBuyVsRentConclusion } from "@calculatorShared/buyVsRentSimple/simpleBuyVsRentConclusion";
import { runCalculatorLocally } from "./calculationsSupabase";

const TEST_INPUT = {
  purchasePrice: 1_500_000,
  monthlyRent: 12_000,
  depositAmount: 150_000,
  interestRate: 11.75,
  analysisYears: 10,
  propertyAppreciation: 5,
  rentEscalation: 6
};

describe("runSimpleBuyVsRentCalculator", () => {
  it("calculates bond on R1,350,000 over 20 years", () => {
    const core = runSimpleBuyVsRentCalculator(TEST_INPUT);
    expect(core.bondAmount).toBe(1_350_000);
    expect(core.monthlyBondPayment).toBeGreaterThan(14_000);
    expect(core.monthlyBondPayment).toBeLessThan(16_000);
  });

  it("produces 3 charts and year-by-year rows", () => {
    const core = runSimpleBuyVsRentCalculator(TEST_INPUT);
    expect(core.yearRows).toHaveLength(10);
    const mapped = mapSimpleBuyVsRentToCalculatorResult(core);
    expect(mapped.chartData).toHaveLength(3);
    const line = mapped.chartData.find((c) => c.title === "Buy vs Rent Over Time");
    expect(line?.data.labels).toHaveLength(11);
  });

  it("generates conclusion text", () => {
    const core = runSimpleBuyVsRentCalculator(TEST_INPUT);
    const text = generateSimpleBuyVsRentConclusion(core.summary, core.inputs);
    expect(text.length).toBeGreaterThan(40);
  });
});

describe("buy-vs-rent simple calculator integration", () => {
  it("runs with standard test case", () => {
    const r = runCalculatorLocally("buy-vs-rent", {
      purchasePrice: 1_500_000,
      monthlyRent: 12_000,
      depositAmount: 150_000,
      interestRate: 11.75,
      analysisYears: 10,
      propertyAppreciation: 5,
      rentEscalation: 6
    });
    expect(r.calculator).toBe("buy-vs-rent");
    expect(r.breakdown?.simple).toBeTruthy();
    expect(r.breakdown?.bondAmount).toBe(1_350_000);
    expect(r.chartData?.length).toBe(3);
    expect(r.interpretation?.text).toMatch(/buying|renting|close/i);
    expect(r.assumptionsUsed?.assumptions).toBeInstanceOf(Array);
  });

  it("rejects deposit equal to purchase price", () => {
    expect(() =>
      runCalculatorLocally("buy-vs-rent", {
        ...{
          purchasePrice: 1_500_000,
          monthlyRent: 12_000,
          depositAmount: 1_500_000,
          interestRate: 11.75,
          analysisYears: 10,
          propertyAppreciation: 5,
          rentEscalation: 6
        }
      })
    ).toThrow();
  });
});
