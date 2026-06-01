import { isInvoiceEditable } from "./invoiceFoundation";

/** True only when the Vercel email route delivers mail (not scaffold / SMTP-only). */
export const INVOICE_EMAIL_DELIVERY_ENABLED = true;

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

export function invoiceAddPaymentMenuLabel(): string {
  return "Add payment";
}

/** @deprecated Use invoiceAddPaymentMenuLabel */
export function invoiceMarkAsPaidMenuLabel(): string {
  return invoiceAddPaymentMenuLabel();
}

export function invoiceMarkAsSentConfirmLabel(): string {
  return "Mark as sent";
}

export const INVOICE_SEND_COMING_SOON_MESSAGE =
  "Sending invoices by email is coming soon. The invoice will be emailed to the tenant, with a copy to the CC address in your account invoice settings.";

export const INVOICE_MARK_SENT_MODAL_TITLE = "Mark invoice as sent?";

export const INVOICE_MARK_SENT_MODAL_MESSAGE =
  "The invoice will be marked as sent. You can still edit it later if you need to make changes.";

export const INVOICE_SENT_EDIT_MODAL_TITLE = "Edit sent invoice?";

export const INVOICE_SENT_EDIT_MODAL_MESSAGE =
  "Are you sure you want to edit this invoice after it has been sent?";

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
  return "Invoice marked as sent.";
}

export function invoiceSendSuccessMessage(statusBeforeSend: unknown): string {
  void statusBeforeSend;
  if (isInvoiceEmailDeliveryAvailable()) {
    return "Invoice sent to tenant.";
  }
  return invoiceMarkAsSentSuccessMessage();
}
