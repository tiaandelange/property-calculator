const INVOICE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** Normalize statement/API invoice identifiers to a canonical UUID (or empty when invalid). */
export function normalizeInvoiceRouteId(raw: unknown): string {
  if (raw == null) return "";
  let id = String(raw).trim();
  if (!id) return "";
  if (id.toUpperCase().startsWith("INVOICE:")) {
    id = id.slice("INVOICE:".length).trim();
  }
  return INVOICE_UUID_RE.test(id) ? id : "";
}

export function invoiceIdFromStatementRow(row: Record<string, unknown>): string {
  const candidates = [row.invoiceId, row.invoice_id, row.sourceId, row.source_id];
  for (const candidate of candidates) {
    const id = normalizeInvoiceRouteId(candidate);
    if (id) return id;
  }
  return "";
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
