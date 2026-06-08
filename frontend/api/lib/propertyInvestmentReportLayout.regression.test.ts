import { describe, expect, it } from "vitest";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { REPORT_PAGE_MARGINS, REPORT_PAGE_ORIENTATION, REPORT_PAGE_SIZE } from "./pdf/globalPdfLayout.js";
import { buildInvestmentReportPdfDefinition, buildPropertySummaryPdfDefinition } from "./reportPdfBuilders.js";
import { assemblePropertyInvestmentReportData } from "./propertyInvestmentReportData.js";
import { buildGlobalPdfTheme } from "./pdf/globalPdfTheme.js";
import { buildInvoicePdfDefinition } from "./invoicePdfBuilder.js";

/** Same calculator payload shape as the broken INVESTMENT_REPORT PDF. */
const CALCULATOR_REGRESSION = {
  propertyType: "single-family",
  answers: {
    purchasePrice: 1_500_000,
    marketValue: 1_600_000,
    closingCosts: 50_000,
    repairsRenovation: 25_000,
    monthlyRent: 12_500,
    cashInvested: 400_000,
    loanAmount: 1_200_000,
    interestRateApr: 11,
    loanTermYears: 20,
    vacancyAllowancePct: 5,
    ratesTaxesMonthly: 1_200,
    insuranceMonthly: 800,
    maintenanceReserveMonthly: 500,
    managementFeePct: 8
  },
  metrics: {
    monthlyIncome: 12_500,
    monthlyExpenses: 9_000,
    projectedCashFlow: 2_500,
    grossYield: 9.5,
    cashOnCashRoi: 7.5,
    ltv: 75,
    internalRateofReturn: 10.2,
    monthlyBondPayment: 11_000
  }
} as const;

function collectStrings(node: unknown, out: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o.text === "string") out.push(o.text);
  if (o.stack) collectStrings(o.stack, out);
  if (o.columns) collectStrings(o.columns, out);
  if (o.ul) collectStrings(o.ul, out);
  if (o.table && typeof o.table === "object") {
    const body = (o.table as { body?: unknown }).body;
    collectStrings(body, out);
  }
}

function definitionText(def: TDocumentDefinitions): string {
  const parts: string[] = [];
  collectStrings(def.content, parts);
  if (typeof def.footer === "function") {
    const footer = def.footer(1, 3, { width: 595.28, height: 841.89, orientation: "portrait" }) as Content;
    collectStrings(footer, parts);
  }
  return parts.join("\n");
}

function definitionJson(def: TDocumentDefinitions): string {
  return JSON.stringify(def);
}

describe("Property Investment Report layout regression", () => {
  it("calculator report uses safe page frame and function footer", () => {
    const { definition } = buildInvestmentReportPdfDefinition(CALCULATOR_REGRESSION);
    expect(definition.pageSize).toBe(REPORT_PAGE_SIZE);
    expect(definition.pageOrientation).toBe(REPORT_PAGE_ORIENTATION);
    expect(definition.pageMargins).toEqual(REPORT_PAGE_MARGINS);
    expect(typeof definition.footer).toBe("function");
    expect(definitionJson(definition)).not.toMatch(/"width"\s*:\s*480/);
    expect(definitionJson(definition)).not.toContain("33.3%");
  });

  it("calculator report passes layout content rules (same data as broken PDF)", () => {
    const { definition } = buildInvestmentReportPdfDefinition(CALCULATOR_REGRESSION);
    const text = definitionText(definition);
    const json = definitionJson(definition);

    expect(text).toContain("Property Investment Report");
    expect(text).toContain("Executive Summary");
    expect(text).toContain("Assumptions");
    expect(text).toContain("Single-family home");
    expect(text).not.toContain("Excellent");
    expect(text).not.toContain('"Bad"');
    expect(text).not.toMatch(/No property image|property image available/i);
    expect(text).not.toContain("Fallback");
    expect(text).not.toMatch(/loanTermYears|vacancyAllowancePct/);
    expect(text).not.toMatch(/\bNaN\b|undefined|null/);
    expect(text).toContain("Operating Expenses");
    expect(text).toContain("below the monthly bond payment");
    expect(text).toContain("Annual Gross Rent");
    expect(text).toContain("Annual cash flow (Y1)");
    expect(text).toContain("50% Rule Projection");
    expect(text).toContain("Income vs Expenses Over Time");
    expect(json).toMatch(/"unbreakable"\s*:\s*true/);
    expect(json).toMatch(/"widths":\["\*","\*","\*","\*"\]/);
    expect(json).toMatch(/"widths":\["55%","45%"\]/);
    expect(json).toMatch(/"widths":\[100,/);
  });

  it("property summary report passes layout content rules", () => {
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
      leases: [],
      invoices: []
    });

    const definition = buildPropertySummaryPdfDefinition({ reportModel: model });
    const text = definitionText(definition);
    expect(text).not.toContain("Fallback");
    expect(text).not.toMatch(/No property image/i);
    expect(definitionJson(definition)).not.toContain("33.3%");
  });

  it("invoice PDF builder remains independent of report layout changes", () => {
    const def = buildInvoicePdfDefinition(
      {
        invoiceId: "11111111-1111-1111-1111-111111111111",
        invoiceNumber: "INV-1",
        invoiceDate: "2026-06-01",
        dueDate: "2026-06-15",
        status: "SENT",
        subtotal: 1000,
        total: 1000,
        balanceDue: 1000,
        notes: null,
        tenantLines: ["Tenant"],
        propertyLines: ["Unit 1"],
        unitLabel: "Unit 1",
        leaseLabel: "Lease",
        paymentReference: "INV-1",
        lineItems: [{ description: "Rent", quantity: 1, unitPrice: 1000, total: 1000 }],
        payments: [],
        paymentDetailLines: ["Bank: Test"],
        isDraftPreview: false
      },
      {
        theme: buildGlobalPdfTheme({ accentColor: "purple" }),
        landlord: { name: "Landlord", email: "a@b.com" },
        tenantPropertyAddress: "1 Main Rd",
        pdfBrandingEnabled: true
      }
    );
    const json = definitionJson(def);
    expect(json).toContain("INV-1");
    expect(json).not.toContain("Property Investment Report");
    expect(def.pageMargins).not.toEqual(REPORT_PAGE_MARGINS);
  });
});
