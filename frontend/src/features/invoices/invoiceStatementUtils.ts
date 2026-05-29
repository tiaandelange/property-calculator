const UNPAID_INVOICE_STATUSES = new Set([
  "GENERATED",
  "DRAFT",
  "SENT",
  "DUE",
  "PARTIALLY_PAID"
]);

/** Credit-column styling for invoice rows on property/tenant statements. */
export function invoiceStatementCreditClass(status: string | null | undefined): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID") return "pg-statement-credit-paid";
  if (s === "OVERDUE") return "pg-statement-credit-unpaid";
  if (UNPAID_INVOICE_STATUSES.has(s)) return "pg-statement-credit-due";
  return "";
}

export function isInvoiceStatementRow(row: Record<string, unknown>): boolean {
  return String(row.source ?? "").toUpperCase() === "INVOICE";
}

export function invoiceIdFromStatementRow(row: Record<string, unknown>): string {
  return String(row.invoiceId ?? row.sourceId ?? "");
}

export function tenantIdFromStatementRow(row: Record<string, unknown>): string {
  return String(row.tenantId ?? "");
}
