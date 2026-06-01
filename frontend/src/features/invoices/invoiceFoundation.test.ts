import { describe, expect, it } from "vitest";
import {
  invoiceStatementUiStatus,
  invoiceStatusLabel,
  isInvoiceContentEditable,
  isInvoiceEditable,
  isInvoicePostSendStatus,
  normalizeInvoiceStatus
} from "./invoiceFoundation";

describe("invoiceFoundation", () => {
  it("normalizes unknown status to DRAFT", () => {
    expect(normalizeInvoiceStatus("bogus")).toBe("DRAFT");
  });

  it("draft-only editability for mark-as-sent", () => {
    expect(isInvoiceEditable("DRAFT")).toBe(true);
    expect(isInvoiceEditable("GENERATED")).toBe(true);
    expect(isInvoiceEditable("SENT")).toBe(false);
    expect(isInvoiceEditable("PAID")).toBe(false);
    expect(isInvoiceEditable("OVERDUE")).toBe(false);
  });

  it("content editability includes sent but not paid or void", () => {
    expect(isInvoiceContentEditable("DRAFT")).toBe(true);
    expect(isInvoiceContentEditable("SENT")).toBe(true);
    expect(isInvoiceContentEditable("PARTIALLY_PAID")).toBe(true);
    expect(isInvoiceContentEditable("PAID")).toBe(false);
    expect(isInvoiceContentEditable("VOID")).toBe(false);
  });

  it("post-send status detection", () => {
    expect(isInvoicePostSendStatus("SENT")).toBe(true);
    expect(isInvoicePostSendStatus("PARTIALLY_PAID")).toBe(true);
    expect(isInvoicePostSendStatus("DRAFT")).toBe(false);
  });

  it("maps GENERATED to Draft for statement UI", () => {
    expect(invoiceStatementUiStatus("GENERATED")).toBe("DRAFT");
    expect(invoiceStatusLabel("GENERATED")).toBe("Draft");
  });
});
