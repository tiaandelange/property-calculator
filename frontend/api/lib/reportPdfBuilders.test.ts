import { describe, expect, it } from "vitest";
import { assemblePropertyInvestmentReportData } from "./propertyInvestmentReportData";
import {
  buildCalculationReportPdfDefinition,
  buildInvestmentReportPdfDefinition,
  buildPropertySummaryPdfDefinition
} from "./reportPdfBuilders";

describe("reportPdfBuilders", () => {
  it("buildCalculationReportPdfDefinition includes chart omission note (no chartjs-node-canvas)", () => {
    const { definition, scenarioName } = buildCalculationReportPdfDefinition({
      calculationId: "11111111-1111-1111-1111-111111111111",
      calcType: "cap-rate",
      inputJson: { purchasePrice: 1_000_000 },
      resultJson: {
        calculator: "cap-rate",
        summary: [{ key: "capRate", label: "Cap rate", value: 8, formatted: "8%" }],
        interpretation: { text: "OK", warnings: [] }
      },
      preparedForLabel: "Test User",
      scenarioNameOverride: "My deal"
    });

    expect(scenarioName).toBe("My deal");
    const text = JSON.stringify(definition.content);
    expect(text).toContain("Chart.js canvas omitted on Vercel");
    expect(text).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("buildPropertySummaryPdfDefinition renders investment report sections", () => {
    const model = assemblePropertyInvestmentReportData({
      propertyRow: {
        name: "Unit 4",
        address_line1: "1 Main Rd",
        city: "Cape Town",
        province: "WC",
        purchase_price: 1_500_000,
        current_estimated_value: 1_500_000,
        outstanding_bond_balance: 1_200_000,
        bond_annual_interest_rate_percent: 11,
        bond_term_years: 30,
        expected_monthly_income: 12_500
      },
      statement: {
        summary: { receivedThisMonth: 10_000, expensesThisMonth: 8_000, balanceDue: 0 },
        recurringCharges: [],
        bondFinance: {}
      },
      leases: [
        {
          status: "ACTIVE",
          monthly_rent: 12_500,
          start_date: "2025-01-01",
          lease_tenants: [{ tenants: { first_name: "Jane", last_name: "Doe" } }]
        }
      ],
      invoices: [
        {
          id: "inv-1",
          invoice_number: "INV-1",
          status: "PARTIALLY_PAID",
          total: 12_500,
          invoice_payments: [{ id: "p1", payment_date: "2026-06-01", amount: 5_000 }]
        }
      ]
    });

    const definition = buildPropertySummaryPdfDefinition({ reportModel: model });

    const text = JSON.stringify(definition.content);
    expect(text).toContain("Property Investment Report");
    expect(text).toContain("Unit 4");
    expect(text).toContain("Analysis Over Time");
    expect(text).toContain('"text":"IRR"');
    expect(text).toContain("50% Rule Projection");
    expect(text).toContain("Projected vs Actual");
    expect(text).toContain("Not enough data to display this chart");
    expect(text).not.toContain("Fallback");
    expect(text).not.toMatch(/loanTermYears|vacancyAllowancePct/);
  });

  it("buildInvestmentReportPdfDefinition uses polished template without raw field names", () => {
    const { definition } = buildInvestmentReportPdfDefinition({
      propertyType: "single-family",
      answers: {
        purchasePrice: 1_500_000,
        marketValue: 1_600_000,
        monthlyRent: 12_500,
        loanAmount: 1_200_000,
        interestRateApr: 11,
        loanTermYears: 20,
        vacancyAllowancePct: 5,
        cashInvested: 400_000
      },
      metrics: {
        monthlyIncome: 12_500,
        monthlyExpenses: 9_000,
        projectedCashFlow: 2_500,
        grossYield: 9.5,
        cashOnCashRoi: 7.5,
        internalRateOfReturn: 12.5,
        ltv: 75,
        monthlyBondPayment: 11_000
      }
    });

    const text = JSON.stringify(definition.content);
    expect(text).toContain("Property Investment Report");
    expect(text).toContain('"text":"IRR"');
    expect(text).toContain("Purchase Price");
    expect(text).not.toContain("Inputs (Selected)");
    expect(text).not.toContain("loanTermYears");
    expect(text).not.toContain("Fallback");
    expect(text).toContain("Loan & Assumptions");
    expect(text).toContain("50% Rule Projection");
  });

  it("calculates CoC ROI from closing costs when deposit is zero", () => {
    const { definition } = buildInvestmentReportPdfDefinition({
      propertyType: "single-family",
      answers: {
        purchasePrice: 2_000_000,
        marketValue: 2_000_000,
        monthlyRent: 20_000,
        loanAmount: 2_000_000,
        cashInvested: 0,
        closingCosts: 80_000
      },
      metrics: {
        monthlyIncome: 20_000,
        monthlyExpenses: 5_000,
        projectedCashFlow: 3_842,
        grossYield: 12,
        ltv: 100,
        monthlyBondPayment: 11_158
      }
    });

    const text = JSON.stringify(definition.content);
    expect(text).toContain("Total Cash Invested");
    expect(text).toContain("57.63%");
    expect(text).toContain('"text":"CoC ROI"');
  });
});
