import { snakeRowToCamel } from "./propertyRowMapping";
import { isInvoiceContentEditable, normalizeInvoiceStatus } from "../features/invoices/invoiceFoundation";
import { mapDbStatementLineItem } from "../features/statements/statementLineItemUtils";

function coerceIsoDateField(v: unknown): string {
  if (v == null) return new Date(0).toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function statementHasPdf(row: Record<string, unknown>, c: Record<string, unknown>): boolean {
  const storageKey = c.pdfStorageKey ?? row.pdf_storage_key;
  return storageKey != null && String(storageKey).trim() !== "";
}

export function dbStatementToClient(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  const hasPdf = statementHasPdf(row, c);
  const storageKey = row.pdf_storage_key ?? c.pdfStorageKey;
  const storageBucket = row.pdf_storage_bucket ?? c.pdfStorageBucket;
  return {
    ...c,
    statementType: String(c.statementType ?? c.statement_type ?? "FINANCIAL").toUpperCase(),
    statementNumber: c.statementNumber ?? c.statement_number,
    statementDate:
      c.statementDate != null ? coerceIsoDateField(c.statementDate) : coerceIsoDateField(c.statement_date),
    periodStart: c.periodStart ?? c.period_start ?? null,
    periodEnd: c.periodEnd ?? c.period_end ?? null,
    openingBalance: c.openingBalance ?? c.opening_balance ?? 0,
    totalAmount: c.total ?? 0,
    status: normalizeInvoiceStatus(c.status),
    isEditable: isInvoiceContentEditable(c.status),
    hasPdf,
    pdfStorageKey: storageKey,
    pdfStorageBucket: storageBucket,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt,
    sentAt: c.sentAt != null ? coerceIsoDateField(c.sentAt) : c.sentAt
  };
}

export function dbStatementBundleToClient(row: Record<string, unknown>): Record<string, unknown> {
  const base = dbStatementToClient(row);
  const rawLines = (row.tenant_statement_line_items ?? base.lineItems) as Record<string, unknown>[] | undefined;
  const lines = Array.isArray(rawLines) ? rawLines.map((l, i) => mapDbStatementLineItem(l, i)) : [];
  return { ...base, lineItems: lines };
}

export function rpcStatementCreateResultToClient(payload: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(payload) as Record<string, unknown>;
  return {
    id: c.id,
    statementNumber: c.statementNumber ?? c.statement_number,
    statementType: c.statementType ?? c.statement_type,
    status: normalizeInvoiceStatus(c.status),
    total: c.total,
    totalAmount: c.total
  };
}
