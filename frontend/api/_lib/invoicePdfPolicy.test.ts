import { describe, expect, it } from "vitest";
import { invoiceHasStoredPdf, invoicePdfStorageKey, shouldPersistInvoicePdf } from "./invoicePdfPolicy";

describe("invoicePdfPolicy", () => {
  it("persists PDF only for sent or finalised statuses", () => {
    expect(shouldPersistInvoicePdf("DRAFT")).toBe(false);
    expect(shouldPersistInvoicePdf("GENERATED")).toBe(false);
    expect(shouldPersistInvoicePdf("SENT")).toBe(true);
    expect(shouldPersistInvoicePdf("PAID")).toBe(true);
    expect(shouldPersistInvoicePdf("VOID")).toBe(false);
  });

  it("builds stable storage key per user and invoice", () => {
    expect(invoicePdfStorageKey("u1", "inv-1")).toBe("u1/invoices/inv-1.pdf");
  });

  it("detects stored PDF metadata", () => {
    expect(
      invoiceHasStoredPdf({ pdf_storage_bucket: "invoices", pdf_storage_key: "u1/invoices/x.pdf" })
    ).toBe(true);
    expect(invoiceHasStoredPdf({ pdf_storage_bucket: "invoices", pdf_storage_key: null })).toBe(false);
  });
});
