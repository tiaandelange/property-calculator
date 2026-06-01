import { describe, expect, it } from "vitest";
import { assemblePropertyInvestmentReportData } from "./propertyInvestmentReportData";
import { buildCalculationReportPdfDefinition, buildPropertySummaryPdfDefinition } from "./reportPdfBuilders";

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
    expect(text).toContain("Analysis over time");
    expect(text).toContain("50% rule projection");
    expect(text).toContain("Proplytic at the time of generation");
  });
});
