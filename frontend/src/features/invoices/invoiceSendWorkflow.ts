import { isInvoiceEditable, normalizeInvoiceStatus } from "./invoiceFoundation";

/** True only when the Vercel email route delivers mail (not scaffold / SMTP-only). */
export const INVOICE_EMAIL_DELIVERY_ENABLED = false;

export function isInvoiceEmailDeliveryAvailable(): boolean {
  return INVOICE_EMAIL_DELIVERY_ENABLED;
}

export function canMarkInvoiceSent(status: unknown): boolean {
  return isInvoiceEditable(status);
}

export function invoiceSendButtonLabel(): string {
  return isInvoiceEmailDeliveryAvailable() ? "Send Invoice" : "Mark as Sent";
}

export function invoiceSendConfirmLabel(): string {
  return isInvoiceEmailDeliveryAvailable() ? "Send Invoice" : "Mark as Sent";
}

export const INVOICE_SEND_MODAL_TITLE = "Send invoice?";

export const INVOICE_SEND_MODAL_MESSAGE =
  "Once this invoice is sent, it can no longer be edited. You will still be able to view, export or delete/void it according to your accounting rules.";

export const INVOICE_SEND_EMAIL_COMING_SOON = "Email sending coming later.";

export function invoiceSendSuccessMessage(statusBeforeSend: unknown): string {
  const wasGenerated = normalizeInvoiceStatus(statusBeforeSend) === "GENERATED";
  if (isInvoiceEmailDeliveryAvailable()) {
    return wasGenerated ? "Invoice sent to tenant." : "Invoice sent to tenant.";
  }
  return wasGenerated
    ? "Invoice marked as sent and locked for editing."
    : "Invoice marked as sent and locked for editing.";
}
