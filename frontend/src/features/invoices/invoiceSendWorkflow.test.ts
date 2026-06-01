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
  it("allows mark-as-sent only for draft and generated", () => {
    expect(canMarkInvoiceSent("DRAFT")).toBe(true);
    expect(canMarkInvoiceSent("GENERATED")).toBe(true);
    expect(canMarkInvoiceSent("SENT")).toBe(false);
    expect(canMarkInvoiceSent("PAID")).toBe(false);
  });

  it("enables email delivery for Send button flow", () => {
    expect(INVOICE_EMAIL_DELIVERY_ENABLED).toBe(true);
    expect(isInvoiceEmailDeliveryAvailable()).toBe(true);
    expect(invoiceSendButtonLabel()).toBe("Send");
    expect(invoiceMarkAsSentMenuLabel()).toBe("Mark as sent");
    expect(invoiceMarkAsSentConfirmLabel()).toBe("Mark as sent");
  });
});
