import { describe, expect, it } from "vitest";
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

  it("buildPropertySummaryPdfDefinition includes property name and summary", () => {
    const definition = buildPropertySummaryPdfDefinition({
      property: {
        name: "Unit 4",
        addressLine1: "1 Main Rd",
        city: "Cape Town",
        province: "WC",
        postalCode: "8001"
      },
      summary: { netCashFlow: 12000 },
      statementRows: [{ date: "2026-05-01", description: "Rent", amount: 10000 }],
      scenarioName: null
    });

    const text = JSON.stringify(definition.content);
    expect(text).toContain("Unit 4");
    expect(text).toContain("1 Main Rd");
    expect(text).toContain("Net cash flow");
    expect(text).toContain("12,000");
  });
});
