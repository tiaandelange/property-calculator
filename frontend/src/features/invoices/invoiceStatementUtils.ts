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
  return String(row.invoiceId ?? row.invoice_id ?? row.sourceId ?? row.source_id ?? "");
}

export function tenantIdFromStatementRow(row: Record<string, unknown>): string {
  return String(row.tenantId ?? row.tenant_id ?? "");
}

/** Property/tenant statement Type column for invoice-linked rows. */
export function invoiceStatementTypeLabel(row: Record<string, unknown>): string {
  const stmtType = String(row.statementType ?? row.statement_type ?? "").toLowerCase();
  if (stmtType === "rent_invoice") return "Rent Invoice";
  if (stmtType === "utility_recovery_invoice") return "Tenant Charge";
  if (isInvoiceStatementRow(row)) return "Invoice";
  return String(row.type ?? row.typ ?? "");
}

export function invoiceStatementDisplayType(row: Record<string, unknown>): string {
  if (isInvoiceStatementRow(row)) return invoiceStatementTypeLabel(row);
  return String(row.type ?? "");
}

/** Statement rows editable inline — invoices must be edited on /invoices/:id. */
export function canEditStatementRow(row: Record<string, unknown>): boolean {
  const source = String(row.source ?? "").toUpperCase();
  const sourceId = row.sourceId ?? row.source_id;
  if (sourceId == null || String(sourceId).trim() === "") return false;
  return source === "EXPENSE" || source === "INCOME";
}
