import { describe, expect, it } from "vitest";
import {
  invoiceIdFromStatementRow,
  invoiceStatementCreditClass,
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
});
