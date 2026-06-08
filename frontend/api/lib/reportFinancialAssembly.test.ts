import { describe, expect, it } from "vitest";
import { assembleCalculatorInvestmentReportData } from "./assembleCalculatorInvestmentReportData.js";
import {
  buildAnnualProjectionRows,
  computeMonthlyFinancials,
  REPORT_PROJECTION_LABELS
} from "./reportFinancialAssembly.js";
import { computeCashOnCashRoiPercent } from "./propertyCalculator/financialMetrics.js";

describe("computeMonthlyFinancials", () => {
  it("separates operating expenses from debt service without double-counting", () => {
    const f = computeMonthlyFinancials({
      monthlyGrossIncome: 25_280,
      effectiveMonthlyIncome: 24_016,
      monthlyOperatingExpenses: 3_500,
      monthlyDebtService: 16_674
    });
    expect(f.monthlyOperatingExpenses).toBe(3_500);
    expect(f.monthlyDebtService).toBe(16_674);
    expect(f.monthlyTotalOutflows).toBe(20_174);
    expect(f.monthlyNoi).toBe(20_516);
    expect(f.monthlyCashFlow).toBe(3_842);
    expect(f.annualCashFlow).toBe(46_104);
    expect(computeCashOnCashRoiPercent(f.annualCashFlow, 80_000)).toBeCloseTo(57.63, 1);
  });
});

describe("buildAnnualProjectionRows", () => {
  it("uses annual values and positive CoC when cash flow is positive", () => {
    const projection = buildAnnualProjectionRows({
      monthlyGrossIncome: 25_280,
      effectiveMonthlyIncome: 24_016,
      monthlyOperating: 3_500,
      monthlyDebtService: 16_674,
      incomeGrowthPct: 0,
      expenseGrowthPct: 0,
      appreciationPct: 0,
      basePropertyValue: 1_600_000,
      startLoan: 1_200_000,
      monthlyLoanPayment: 16_674,
      ratePct: 11,
      totalCashInvested: 80_000,
      irrByHorizon: [100.26]
    });
    const gross = projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.annualGrossRent);
    const effective = projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.effectiveAnnualIncome);
    const operating = projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.annualOperatingExpenses);
    const coc = projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.cashOnCashRoi);
    const cashFlow = projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.cashFlowAfterDebt);

    expect(gross?.values[0]).toBe(25_280 * 12);
    expect(effective?.values[0]).toBe(24_016 * 12);
    expect(operating?.values[0]).toBe(3_500 * 12);
    expect(cashFlow?.values[0]).toBe(46_104);
    expect(coc?.values[0]).toBeCloseTo(57.63, 1);
    expect((coc?.values[0] ?? 0) > 0).toBe(true);
  });
});

describe("assembleCalculatorInvestmentReportData QA scenario", () => {
  it("maps operating expenses and projections for sample calculator inputs", () => {
    const model = assembleCalculatorInvestmentReportData({
      propertyType: "single-family",
      answers: {
        purchasePrice: 1_525_000,
        marketValue: 1_600_000,
        monthlyRent: 25_280,
        vacancyAllowancePct: 5,
        ratesTaxesMonthly: 2_500,
        insuranceMonthly: 500,
        maintenanceReserveMonthly: 500,
        loanAmount: 1_200_000,
        interestRateApr: 11,
        loanTermYears: 20,
        cashInvested: 0,
        closingCosts: 80_000
      },
      metrics: {
        monthlyIncome: 24_016,
        monthlyExpenses: 20_174,
        monthlyBondPayment: 16_674,
        projectedCashFlow: 3_842,
        grossYield: 19.88,
        cashOnCashRoi: 57.63,
        internalRateOfReturn: 100.26,
        ltv: 70.37
      }
    });

    expect(model.metrics.monthlyIncome).toBe(25_280);
    expect(model.metrics.monthlyExpenses).toBe(3_500);
    expect(model.metrics.monthlyCashFlow).toBe(3_842);
    expect(model.metrics.cashOnCashRoi).toBeCloseTo(57.63, 1);

    const cocRow = model.projection.rows.find((r) => r.label === REPORT_PROJECTION_LABELS.cashOnCashRoi);
    expect((cocRow?.values[0] ?? 0) > 0).toBe(true);

    const comparisonOperating = model.comparison.find((c) => c.metric === "Operating Expenses");
    expect(comparisonOperating?.projected).toMatch(/3[\s\u00A0]?500/);

    const fiftyResult = model.fiftyPercentRule.find((r) => r.label === "Result")?.value;
    expect(fiftyResult).toBe("Does Not Meet 50% Rule");
  });
});
