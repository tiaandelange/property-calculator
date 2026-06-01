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

  it("uses Send as main action and Mark as sent in menu when email delivery is disabled", () => {
    expect(INVOICE_EMAIL_DELIVERY_ENABLED).toBe(false);
    expect(isInvoiceEmailDeliveryAvailable()).toBe(false);
    expect(invoiceSendButtonLabel()).toBe("Send");
    expect(invoiceMarkAsSentMenuLabel()).toBe("Mark as sent");
    expect(invoiceMarkAsSentConfirmLabel()).toBe("Mark as sent");
  });
});
