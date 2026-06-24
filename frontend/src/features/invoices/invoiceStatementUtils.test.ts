import { describe, expect, it } from "vitest";
import {
  canEditStatementRow,
  invoiceIdFromStatementRow,
  normalizeInvoiceRouteId,
  invoiceStatementCreditClass,
  invoiceStatementDisplayType,
  invoiceStatementTypeLabel,
  isInvoiceStatementRow,
  tenantIdFromStatementRow
} from "./invoiceStatementUtils";

const SAMPLE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("invoiceStatementUtils", () => {
  it("maps invoice statuses to credit classes", () => {
    expect(invoiceStatementCreditClass("PAID")).toBe("pg-statement-credit-paid");
    expect(invoiceStatementCreditClass("OVERDUE")).toBe("pg-statement-credit-unpaid");
    expect(invoiceStatementCreditClass("GENERATED")).toBe("pg-statement-credit-due");
    expect(invoiceStatementCreditClass("SENT")).toBe("pg-statement-credit-due");
  });

  it("reads invoice and tenant ids from statement rows", () => {
    const row = {
      source: "INVOICE",
      invoiceId: SAMPLE_UUID,
      tenantId: "ten-1",
      sourceId: "fallback-should-not-win"
    };
    expect(isInvoiceStatementRow(row)).toBe(true);
    expect(invoiceIdFromStatementRow(row)).toBe(SAMPLE_UUID);
    expect(tenantIdFromStatementRow(row)).toBe("ten-1");
    expect(invoiceIdFromStatementRow({ sourceId: SAMPLE_UUID })).toBe(SAMPLE_UUID);
    expect(invoiceIdFromStatementRow({ source_id: SAMPLE_UUID })).toBe(SAMPLE_UUID);
    expect(normalizeInvoiceRouteId(`INVOICE:${SAMPLE_UUID}`)).toBe(SAMPLE_UUID);
    expect(normalizeInvoiceRouteId("INV-26-0005")).toBe("");
  });

  it("labels invoice statement types", () => {
    expect(invoiceStatementTypeLabel({ source: "INVOICE", statementType: "rent_invoice" })).toBe("Rent Invoice");
    expect(invoiceStatementTypeLabel({ source: "INVOICE", statementType: "utility_recovery_invoice" })).toBe(
      "Tenant Charge"
    );
    expect(invoiceStatementDisplayType({ source: "INVOICE", statementType: "invoice" })).toBe("Invoice");
  });

  it("allows inline edit only for expense and income rows", () => {
    expect(canEditStatementRow({ source: "INVOICE", sourceId: "inv-1" })).toBe(false);
    expect(canEditStatementRow({ source: "EXPENSE", sourceId: "exp-1" })).toBe(true);
    expect(canEditStatementRow({ source: "INCOME", sourceId: "inc-1" })).toBe(true);
  });
});
