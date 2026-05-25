import { inferMonthlyBondPaymentForExpenseBaseline } from "../../../shared/calculatorShared/bondHelpers";

describe("inferMonthlyBondPaymentForExpenseBaseline", () => {
  const asOf = new Date("2026-05-01T12:00:00.000Z");

  test("returns amortising instalment from balance, rate, and remaining months", () => {
    const p = {
      outstandingBondBalance: 1_900_000,
      bondAnnualInterestRatePercent: 11.75,
      bondTermYears: 20,
      bondStartDate: "2018-01-01",
      monthlyBondPayment: null
    };
    const m = inferMonthlyBondPaymentForExpenseBaseline(p, asOf);
    expect(m).not.toBeNull();
    expect(m!.monthlyPayment).toBeGreaterThan(15_000);
    expect(m!.usedFallbackNominalRate).toBe(false);
  });

  test("returns non-null instalment when rate missing — uses fallback nominal rate", () => {
    const m = inferMonthlyBondPaymentForExpenseBaseline(
      {
        outstandingBondBalance: 1_900_000,
        bondAnnualInterestRatePercent: null,
        bondTermYears: 20,
        bondStartDate: "2018-01-01",
        monthlyBondPayment: null
      },
      asOf
    );
    expect(m).not.toBeNull();
    expect(m!.usedFallbackNominalRate).toBe(true);
    expect(m!.monthlyPayment).toBeGreaterThan(15_000);
  });

  test("returns null when no balance", () => {
    expect(inferMonthlyBondPaymentForExpenseBaseline({ outstandingBondBalance: 0, bondAnnualInterestRatePercent: 10 }, asOf)).toBeNull();
  });
});
