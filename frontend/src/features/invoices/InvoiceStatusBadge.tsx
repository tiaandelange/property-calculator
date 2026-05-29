import { INVOICE_STATUSES, invoiceStatusLabel } from "./invoiceFoundation";
import { ProplyticStatusBadge } from "../../components/tables";

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <ProplyticStatusBadge status={status} label={invoiceStatusLabel(status)} />;
}

export const INVOICE_STATUS_FILTER_OPTIONS = ["ALL", ...INVOICE_STATUSES] as const;

export function invoiceStatusFilterLabel(status: string): string {
  if (status === "ALL") return "All statuses";
  return invoiceStatusLabel(status);
}
