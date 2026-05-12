import {
  buildPortfolioAnalysisHorizonYears,
  buildPortfolioAnalysisOverTime,
  ownershipYearFromPurchase,
  portfolioBondScheduleHorizonYearsCeiling
} from "../../src/domains/properties/property.portfolioIrr";

describe("ownershipYearFromPurchase", () => {
  test("counts ownership years from purchase month", () => {
    const purchase = new Date(2022, 5, 15); // June 2022
    expect(ownershipYearFromPurchase(purchase, new Date(2026, 4, 1))).toBe(4); // May 2026
    expect(ownershipYearFromPurchase(purchase, new Date(2023, 5, 1))).toBe(2); // June 2023
  });
});

describe("buildPortfolioAnalysisHorizonYears", () => {
  test("includes milestones up to cap and always includes cap year", () => {
    expect(buildPortfolioAnalysisHorizonYears(20)).toEqual([1, 2, 3, 4, 5, 10, 15, 20]);
    expect(buildPortfolioAnalysisHorizonYears(7)).toEqual([1, 2, 3, 4, 5, 7]);
    expect(buildPortfolioAnalysisHorizonYears(1)).toEqual([1]);
  });
});

describe("portfolioBondScheduleHorizonYearsCeiling", () => {
  test("uses longest remaining bond schedule", () => {
    const asOf = new Date(2026, 0, 1);
    const five = portfolioBondScheduleHorizonYearsCeiling(
      [
        { outstandingBondBalance: 100, bondRemainingTermMonths: 55 },
        { outstandingBondBalance: 200, bondRemainingTermMonths: 125 }
      ],
      asOf
    );
    expect(five.limitedByBondSchedule).toBe(true);
    expect(five.capYears).toBe(11); // ceil(125/12)
  });

  test("defaults to 30 years when no bond schedules resolve", () => {
    const asOf = new Date(2026, 0, 1);
    const r = portfolioBondScheduleHorizonYearsCeiling([{ outstandingBondBalance: 0 }], asOf);
    expect(r.limitedByBondSchedule).toBe(false);
    expect(r.capYears).toBe(30);
  });
});

describe("buildPortfolioAnalysisOverTime", () => {
  test("escalates operating totals using admin growth rates and caps columns by bond term", () => {
    const p = {
      id: 1,
      name: "Test",
      purchaseDate: new Date(2022, 5, 15),
      currentEstimatedValue: 1_000_000,
      outstandingBondBalance: 600_000,
      bondAnnualInterestRatePercent: 12,
      monthlyBondPayment: 6000,
      bondRemainingTermMonths: 240,
      expectedMonthlyIncome: 10_000,
      expectedMonthlyExpenses: 4000,
      leases: []
    };
    const projectionAsOf = new Date(2026, 4, 1);
    const result = buildPortfolioAnalysisOverTime({
      properties: [p],
      statementMonthlyAverageByProperty: new Map(),
      currentMonthStatementIncomeByProperty: new Map([[1, 0]]),
      expenseMonthByProperty: new Map([[1, []]]),
      growth: { rentalIncomeGrowthPercentAnnual: 10, totalExpensesGrowthPercentAnnual: 5 },
      appreciationDefaultPercent: 5,
      sellCostDefaultPercent: 5,
      projectionAsOf,
      totalCashInvested: 500_000,
      estimateCashInvestedForIrr: () => 500_000
    });

    expect(result.limitedByBondSchedule).toBe(true);
    expect(result.bondHorizonCapYears).toBe(20);

    const cols = result.columns;
    expect(cols.map((c) => c.year)).toEqual([1, 2, 3, 4, 5, 10, 15, 20]);
    expect(cols.some((c) => c.year === 25 || c.year === 30)).toBe(false);

    const y1 = cols.find((c) => c.year === 1)!;
    expect(y1.totalExpectedIncomeAnnual).toBeCloseTo(120_000, 0);
    expect(y1.totalExpensesAnnual).toBeCloseTo(48_000, 0);
    expect(y1.totalAnnualCashFlow).toBeCloseTo(72_000, 0);
    expect(y1.cashOnCashRoiPercent).toBeCloseTo(14.4, 1);

    const y2 = cols.find((c) => c.year === 2)!;
    expect(y2.totalExpectedIncomeAnnual).toBeCloseTo(132_000, 0);
    expect(y2.totalExpensesAnnual).toBeCloseTo(50_400, 0);

    expect(cols.find((c) => c.year === 1)!.headerLabel).toBe("Year 4 (current)");
    expect(cols.find((c) => c.year === 2)!.headerLabel).toBe("Year 5");
    expect(cols.find((c) => c.year === 20)!.headerLabel).toBe("Year 23");

    expect(cols.every((c) => typeof c.irrPercent === "number" || c.irrPercent === null)).toBe(true);
    expect(cols.some((c) => c.irrPercent != null)).toBe(true);
  });

  test("falls back to projection-year labels when no purchase date", () => {
    const p = {
      id: 1,
      name: "Test",
      currentEstimatedValue: 500_000,
      outstandingBondBalance: 0,
      expectedMonthlyIncome: 5000,
      expectedMonthlyExpenses: 2000,
      leases: []
    };
    const result = buildPortfolioAnalysisOverTime({
      properties: [p],
      statementMonthlyAverageByProperty: new Map(),
      currentMonthStatementIncomeByProperty: new Map([[1, 0]]),
      expenseMonthByProperty: new Map([[1, []]]),
      growth: { rentalIncomeGrowthPercentAnnual: 0, totalExpensesGrowthPercentAnnual: 0 },
      appreciationDefaultPercent: 5,
      sellCostDefaultPercent: 5,
      projectionAsOf: new Date(2026, 0, 1),
      totalCashInvested: 100_000,
      estimateCashInvestedForIrr: () => null
    });
    expect(result.limitedByBondSchedule).toBe(false);
    expect(result.columns.map((c) => c.year)).toContain(30);
    expect(result.columns[0].headerLabel).toBe("Yr 1 (current)");
    expect(result.columns[1].headerLabel).toBe("Year 2");
    expect(result.columns.every((c) => c.irrPercent === null)).toBe(true);
  });
});
