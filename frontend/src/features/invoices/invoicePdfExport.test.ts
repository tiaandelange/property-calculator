import { describe, expect, it } from "vitest";
import { invoicePdfWasStored } from "./invoicePdfExport";

describe("invoicePdfExport", () => {
  it("detects stored vs ephemeral PDF responses", () => {
    expect(invoicePdfWasStored({ invoiceId: "x", hasPdf: true, ephemeral: false })).toBe(true);
    expect(invoicePdfWasStored({ invoiceId: "x", hasPdf: false, ephemeral: true, pdfBase64: "abc" })).toBe(false);
    expect(invoicePdfWasStored({ invoiceId: "x", hasPdf: true, reused: true })).toBe(true);
  });
});
