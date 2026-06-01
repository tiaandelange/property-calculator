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
  return "Send";
}

export function invoiceMarkAsSentMenuLabel(): string {
  return "Mark as sent";
}

export function invoiceMarkAsSentConfirmLabel(): string {
  return "Mark as sent";
}

export const INVOICE_SEND_COMING_SOON_MESSAGE =
  "Sending invoices by email is coming soon. The invoice will be emailed to the tenant, with a copy to the CC address in your account invoice settings.";

export const INVOICE_MARK_SENT_MODAL_TITLE = "Mark invoice as sent?";

export const INVOICE_MARK_SENT_MODAL_MESSAGE =
  "The invoice will be locked for editing. You can still view, export, or delete/void it according to your accounting rules.";

/** @deprecated Use INVOICE_MARK_SENT_MODAL_TITLE */
export const INVOICE_SEND_MODAL_TITLE = INVOICE_MARK_SENT_MODAL_TITLE;

/** @deprecated Use INVOICE_MARK_SENT_MODAL_MESSAGE */
export const INVOICE_SEND_MODAL_MESSAGE = INVOICE_MARK_SENT_MODAL_MESSAGE;

/** @deprecated Email delivery not enabled yet */
export const INVOICE_SEND_EMAIL_COMING_SOON = INVOICE_SEND_COMING_SOON_MESSAGE;

/** @deprecated Use invoiceMarkAsSentConfirmLabel */
export function invoiceSendConfirmLabel(): string {
  return invoiceMarkAsSentConfirmLabel();
}

export function invoiceMarkAsSentSuccessMessage(): string {
  return "Invoice marked as sent and locked for editing.";
}

export function invoiceSendSuccessMessage(statusBeforeSend: unknown): string {
  void statusBeforeSend;
  if (isInvoiceEmailDeliveryAvailable()) {
    return "Invoice sent to tenant.";
  }
  return invoiceMarkAsSentSuccessMessage();
}
