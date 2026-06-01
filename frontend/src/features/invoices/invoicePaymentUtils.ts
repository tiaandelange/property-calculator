import { snakeRowToCamel } from "../../api/propertyRowMapping";

export type InvoicePaymentRow = {
  id: string;
  invoiceId: string;
  paymentDate: string;
  paymentReference: string | null;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
};

export function mapInvoicePayment(row: Record<string, unknown>): InvoicePaymentRow {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  const dateRaw = c.paymentDate ?? c.payment_date;
  const dateStr =
    dateRaw != null
      ? String(dateRaw).length >= 10
        ? String(dateRaw).slice(0, 10)
        : String(dateRaw)
      : "";
  return {
    id: String(c.id ?? ""),
    invoiceId: String(c.invoiceId ?? c.invoice_id ?? ""),
    paymentDate: dateStr,
    paymentReference:
      c.paymentReference != null
        ? String(c.paymentReference)
        : c.payment_reference != null
          ? String(c.payment_reference)
          : null,
    amount: Number(c.amount ?? 0),
    createdAt: c.createdAt != null ? String(c.createdAt) : undefined,
    updatedAt: c.updatedAt != null ? String(c.updatedAt) : undefined
  };
}

export function mapInvoicePayments(raw: unknown): InvoicePaymentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => mapInvoicePayment(r as Record<string, unknown>));
}

export function sumInvoicePayments(payments: InvoicePaymentRow[]): number {
  return payments.reduce((acc, p) => acc + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

export function invoiceAmountDue(invoiceTotal: number, payments: InvoicePaymentRow[]): number {
  return Math.max(0, invoiceTotal - sumInvoicePayments(payments));
}

export function formatPaymentDateLabel(isoDate: string): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
