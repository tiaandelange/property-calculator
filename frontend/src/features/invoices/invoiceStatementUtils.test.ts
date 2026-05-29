import { describe, expect, it } from "vitest";
import {
  canEditStatementRow,
  invoiceIdFromStatementRow,
  invoiceStatementCreditClass,
  invoiceStatementDisplayType,
  invoiceStatementTypeLabel,
  isInvoiceStatementRow,
  tenantIdFromStatementRow
} from "./invoiceStatementUtils";

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
      invoiceId: "inv-1",
      tenantId: "ten-1",
      sourceId: "fallback"
    };
    expect(isInvoiceStatementRow(row)).toBe(true);
    expect(invoiceIdFromStatementRow(row)).toBe("inv-1");
    expect(tenantIdFromStatementRow(row)).toBe("ten-1");
    expect(invoiceIdFromStatementRow({ sourceId: "only-source" })).toBe("only-source");
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
