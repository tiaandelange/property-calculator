import { describe, expect, it } from "vitest";
import { isInvoiceEditable, normalizeInvoiceStatus } from "./invoiceFoundation";

describe("invoiceFoundation", () => {
  it("normalizes unknown status to DRAFT", () => {
    expect(normalizeInvoiceStatus("draft")).toBe("DRAFT");
    expect(normalizeInvoiceStatus("bogus")).toBe("DRAFT");
  });

  it("allows edit only for draft and generated", () => {
    expect(isInvoiceEditable("DRAFT")).toBe(true);
    expect(isInvoiceEditable("GENERATED")).toBe(true);
    expect(isInvoiceEditable("SENT")).toBe(false);
    expect(isInvoiceEditable("PAID")).toBe(false);
    expect(isInvoiceEditable("OVERDUE")).toBe(false);
  });
});
