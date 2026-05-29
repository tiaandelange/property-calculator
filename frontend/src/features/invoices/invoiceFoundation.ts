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

/** User-facing status label (GENERATED displays as Draft). */
export function invoiceStatusLabel(status: unknown): string {
  const s = normalizeInvoiceStatus(status);
  if (s === "GENERATED") return "Draft";
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function isInvoiceTerminal(status: unknown): boolean {
  return ["CANCELLED", "VOID"].includes(normalizeInvoiceStatus(status));
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
