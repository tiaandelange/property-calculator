import { describe, expect, it } from "vitest";
import { invoiceStatementUiStatus, invoiceStatusLabel, isInvoiceEditable, normalizeInvoiceStatus } from "./invoiceFoundation";

describe("invoiceFoundation", () => {
  it("normalizes unknown status to DRAFT", () => {
    expect(normalizeInvoiceStatus("draft")).toBe("DRAFT");
    expect(normalizeInvoiceStatus("bogus")).toBe("DRAFT");
  });

  it("maps GENERATED to DRAFT for statement display", () => {
    expect(invoiceStatementUiStatus("GENERATED")).toBe("DRAFT");
    expect(invoiceStatusLabel("GENERATED")).toBe("Draft");
  });

  it("allows edit only for draft and generated", () => {
    expect(isInvoiceEditable("DRAFT")).toBe(true);
    expect(isInvoiceEditable("GENERATED")).toBe(true);
    expect(isInvoiceEditable("SENT")).toBe(false);
    expect(isInvoiceEditable("PAID")).toBe(false);
    expect(isInvoiceEditable("OVERDUE")).toBe(false);
  });
});
