import { describe, expect, it } from "vitest";
import {
  canMarkInvoiceSent,
  canEditInvoiceDueDate,
  invoiceStatementUiStatus,
  invoiceStatusLabel,
  isInvoiceContentEditable,
  isInvoiceEditable,
  isInvoiceMarkedSent,
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
    expect(isInvoicePostSendStatus("PARTIALLY_PAID", null)).toBe(false);
    expect(isInvoicePostSendStatus("PARTIALLY_PAID", "2026-01-01T12:00:00.000Z")).toBe(true);
  });

  it("sent workflow is independent of payment status", () => {
    expect(isInvoiceMarkedSent("2026-01-01T12:00:00.000Z")).toBe(true);
    expect(isInvoiceMarkedSent(null)).toBe(false);
    expect(canMarkInvoiceSent("PARTIALLY_PAID", null)).toBe(true);
    expect(canMarkInvoiceSent("PARTIALLY_PAID", "2026-01-01T12:00:00.000Z")).toBe(false);
    expect(canMarkInvoiceSent("PAID", null)).toBe(true);
    expect(canMarkInvoiceSent("VOID", null)).toBe(false);
  });

  it("due date editing allowed on non-terminal invoices", () => {
    expect(canEditInvoiceDueDate("PAID")).toBe(true);
    expect(canEditInvoiceDueDate("SENT")).toBe(true);
    expect(canEditInvoiceDueDate("VOID")).toBe(false);
  });

  it("maps GENERATED to Draft for statement UI", () => {
    expect(invoiceStatementUiStatus("GENERATED")).toBe("DRAFT");
    expect(invoiceStatusLabel("GENERATED")).toBe("Draft");
  });
});
