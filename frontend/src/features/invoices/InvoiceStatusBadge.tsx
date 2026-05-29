import { INVOICE_STATUSES, invoiceStatusLabel } from "./invoiceFoundation";

export function InvoiceStatusBadge({ status }: { status: string }) {
  const s = String(status).toUpperCase();
  let cls = "pg-invoices-badge";
  if (s === "PAID") cls += " pg-invoices-badge--success";
  else if (s === "OVERDUE") cls += " pg-invoices-badge--danger";
  else if (s === "VOID" || s === "CANCELLED") cls += " pg-invoices-badge--muted";
  else if (s === "SENT") cls += " pg-invoices-badge--primary";
  else if (["GENERATED", "DUE", "PARTIALLY_PAID"].includes(s)) cls += " pg-invoices-badge--warning";
  else if (s === "DRAFT") cls += " pg-invoices-badge--neutral";
  else cls += " pg-invoices-badge--warning";

  return <span className={cls}>{invoiceStatusLabel(status)}</span>;
}

export const INVOICE_STATUS_FILTER_OPTIONS = ["ALL", ...INVOICE_STATUSES] as const;

export function invoiceStatusFilterLabel(status: string): string {
  if (status === "ALL") return "All statuses";
  return invoiceStatusLabel(status);
}
