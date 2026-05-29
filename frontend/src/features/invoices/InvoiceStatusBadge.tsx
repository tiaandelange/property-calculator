import { INVOICE_STATUSES } from "./invoiceFoundation";

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

  const label = s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return <span className={cls}>{label}</span>;
}

export const INVOICE_STATUS_FILTER_OPTIONS = ["ALL", ...INVOICE_STATUSES] as const;
