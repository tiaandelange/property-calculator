import { describe, expect, it } from "vitest";
import {
  INVOICE_EMAIL_DELIVERY_ENABLED,
  canMarkInvoiceSent,
  invoiceMarkAsSentConfirmLabel,
  invoiceMarkAsSentMenuLabel,
  invoiceSendButtonLabel,
  isInvoiceEmailDeliveryAvailable
} from "./invoiceSendWorkflow";

describe("invoiceSendWorkflow", () => {
  it("allows mark-as-sent when not yet sent, including after partial payment", () => {
    expect(canMarkInvoiceSent("DRAFT")).toBe(true);
    expect(canMarkInvoiceSent("GENERATED")).toBe(true);
    expect(canMarkInvoiceSent("PARTIALLY_PAID", null)).toBe(true);
    expect(canMarkInvoiceSent("SENT", "2026-01-01T12:00:00.000Z")).toBe(false);
    expect(canMarkInvoiceSent("PAID", "2026-01-01T12:00:00.000Z")).toBe(false);
    expect(canMarkInvoiceSent("VOID", null)).toBe(false);
  });

  it("enables email delivery for Send button flow", () => {
    expect(INVOICE_EMAIL_DELIVERY_ENABLED).toBe(true);
    expect(isInvoiceEmailDeliveryAvailable()).toBe(true);
    expect(invoiceSendButtonLabel()).toBe("Send");
    expect(invoiceMarkAsSentMenuLabel()).toBe("Mark as sent");
    expect(invoiceMarkAsSentConfirmLabel()).toBe("Mark as sent");
  });
});
