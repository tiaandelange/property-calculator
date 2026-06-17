/** Global invoice foundation — maps to `public.invoices` + `invoice_line_items` (view: `invoice_items`). */

export const INVOICE_STATUSES = [
  "DRAFT",
  "GENERATED",
  "SENT",
  "DUE",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
  "VOID"
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TYPES = ["RENT", "MANUAL", "UTILITY_RECOVERY", "OTHER"] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

/** Statuses where header and line items may be edited. */
export const INVOICE_EDITABLE_STATUSES: ReadonlySet<string> = new Set(["DRAFT", "GENERATED"]);

export function normalizeInvoiceStatus(status: unknown): InvoiceStatus {
  const s = String(status ?? "DRAFT").toUpperCase();
  return (INVOICE_STATUSES.includes(s as InvoiceStatus) ? s : "DRAFT") as InvoiceStatus;
}

export function isInvoiceEditable(status: unknown): boolean {
  return INVOICE_EDITABLE_STATUSES.has(normalizeInvoiceStatus(status));
}

/** Header and line items may be edited (includes sent / partially paid; not paid or void). */
export function isInvoiceContentEditable(status: unknown): boolean {
  const s = normalizeInvoiceStatus(status);
  return s !== "PAID" && s !== "CANCELLED" && s !== "VOID";
}

/** Invoice was sent or is in a post-send lifecycle state (confirm before editing). */
export function isInvoicePostSendStatus(status: unknown, sentAt?: unknown): boolean {
  if (sentAt !== undefined) {
    return isInvoiceMarkedSent(sentAt);
  }
  const s = normalizeInvoiceStatus(status);
  return s === "SENT" || s === "PARTIALLY_PAID" || s === "DUE" || s === "OVERDUE";
}

/** Statement/UI grouping: GENERATED is shown as draft. */
export function invoiceStatementUiStatus(status: unknown): InvoiceStatus {
  const s = normalizeInvoiceStatus(status);
  return s === "GENERATED" ? "DRAFT" : s;
}

/** User-facing status label (GENERATED displays as Draft). */
export function invoiceStatusLabel(status: unknown): string {
  const s = invoiceStatementUiStatus(status);
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function isInvoiceTerminal(status: unknown): boolean {
  return ["CANCELLED", "VOID"].includes(normalizeInvoiceStatus(status));
}

/** Invoice has been marked or recorded as sent (workflow), independent of payment status. */
export function isInvoiceMarkedSent(sentAt: unknown): boolean {
  if (sentAt == null) return false;
  return String(sentAt).trim() !== "";
}

/**
 * Whether the user can mark the invoice as sent.
 * Payments may set PARTIALLY_PAID / PAID without implying the invoice was sent.
 */
export function canMarkInvoiceSent(status: unknown, sentAt?: unknown): boolean {
  if (isInvoiceTerminal(status)) return false;
  if (isInvoiceMarkedSent(sentAt)) return false;
  return true;
}

/** Due date may be edited on any non-terminal invoice. */
export function canEditInvoiceDueDate(status: unknown): boolean {
  return !isInvoiceTerminal(status);
}

/** Invoice can accept a payment (full or partial). */
export function canRecordInvoicePayment(status: unknown): boolean {
  const s = normalizeInvoiceStatus(status);
  return s !== "PAID" && s !== "CANCELLED" && s !== "VOID";
}

/** Line-item categories that post as tenant recoveries (invoice-linked credit on statements). */
export const UTILITY_RECOVERY_CATEGORIES = ["UTILITIES_RECOVERY"] as const;

export type InvoiceListFilters = {
  propertyId?: string;
  tenantId?: string;
  leaseId?: string;
  unitId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  invoiceType?: InvoiceType;
  invoicePeriod?: string;
};
