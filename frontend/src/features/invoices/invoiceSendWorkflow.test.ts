import { describe, expect, it } from "vitest";
import {
  INVOICE_EMAIL_DELIVERY_ENABLED,
  canMarkInvoiceSent,
  invoiceSendButtonLabel,
  invoiceSendConfirmLabel,
  isInvoiceEmailDeliveryAvailable
} from "./invoiceSendWorkflow";

describe("invoiceSendWorkflow", () => {
  it("allows mark-as-sent only for draft and generated", () => {
    expect(canMarkInvoiceSent("DRAFT")).toBe(true);
    expect(canMarkInvoiceSent("GENERATED")).toBe(true);
    expect(canMarkInvoiceSent("SENT")).toBe(false);
    expect(canMarkInvoiceSent("PAID")).toBe(false);
  });

  it("uses Mark as Sent labels when email delivery is disabled", () => {
    expect(INVOICE_EMAIL_DELIVERY_ENABLED).toBe(false);
    expect(isInvoiceEmailDeliveryAvailable()).toBe(false);
    expect(invoiceSendButtonLabel()).toBe("Mark as Sent");
    expect(invoiceSendConfirmLabel()).toBe("Mark as Sent");
  });
});
