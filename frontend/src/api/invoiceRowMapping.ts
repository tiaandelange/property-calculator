import { snakeRowToCamel } from "./propertyRowMapping";
import { isInvoiceEditable, normalizeInvoiceStatus } from "../features/invoices/invoiceFoundation";

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

function mapLineItem(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  const amount = c.amount ?? c.total;
  return {
    ...c,
    amount,
    total: c.total ?? amount,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt
  };
}

function invoiceHasPdf(row: Record<string, unknown>, c: Record<string, unknown>): boolean {
  const storageKey = c.pdfStorageKey ?? (row as Record<string, unknown>).pdf_storage_key;
  if (storageKey != null && String(storageKey).trim() !== "") return true;
  const pdfRaw = c.pdfPath ?? (row as Record<string, unknown>).pdf_path;
  return Boolean(pdfRaw && String(pdfRaw).trim() !== "");
}

/** One invoice row from `invoices` (snake_case or camel). */
export function dbInvoiceToClient(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  const id = c.id;
  const hasPdf = invoiceHasPdf(row, c);
  const core = { ...c } as Record<string, unknown>;
  delete core.pdfPath;
  delete core.pdf_path;
  delete core.pdfStorageBucket;
  delete core.pdfStorageKey;
  delete core.pdf_storage_bucket;
  delete core.pdf_storage_key;
  const storageKey = (row as Record<string, unknown>).pdf_storage_key ?? c.pdfStorageKey;
  const storageBucket = (row as Record<string, unknown>).pdf_storage_bucket ?? c.pdfStorageBucket;
  return {
    ...core,
    id,
    primaryTenantId: c.tenantId ?? c.tenant_id,
    issueDate:
      c.issueDate != null
        ? coerceIsoDateField(c.issueDate)
        : c.invoiceDate != null
          ? coerceIsoDateField(c.invoiceDate)
          : c.invoiceDate,
    invoiceDate: c.invoiceDate != null ? coerceIsoDateField(c.invoiceDate) : c.invoiceDate,
    dueDate: c.dueDate != null ? coerceIsoDateField(c.dueDate) : c.dueDate,
    invoiceType: c.invoiceType ?? c.invoice_type ?? "MANUAL",
    invoicePeriod: c.invoicePeriod ?? c.invoice_period ?? null,
    totalAmount: c.totalAmount ?? c.total_amount ?? c.total,
    balanceDue: c.balanceDue ?? c.balance_due ?? null,
    taxAmount: c.taxAmount ?? c.tax_amount ?? 0,
    status: normalizeInvoiceStatus(c.status),
    isEditable: isInvoiceEditable(c.status),
    deletedAt: c.archivedAt != null ? coerceIsoDateField(c.archivedAt) : c.archivedAt,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt,
    sentAt: c.sentAt != null ? coerceIsoDateField(c.sentAt) : c.sentAt,
    paidAt: c.paidAt != null ? coerceIsoDateField(c.paidAt) : c.paidAt,
    archivedAt: c.archivedAt != null ? coerceIsoDateField(c.archivedAt) : c.archivedAt,
    hasPdf,
    /** Filled with Supabase signed URL in `invoicesSupabase`; legacy Express uses `/api/invoices/:id/download`. */
    downloadUrl:
      hasPdf && id != null && storageKey && storageBucket
        ? null
        : hasPdf && id != null
          ? `/api/invoices/${id}/download`
          : null,
    pdfStorageBucket: storageBucket ?? null,
    pdfStorageKey: storageKey ?? null
  };
}

function nestedLineItems(row: Record<string, unknown>): unknown[] | null {
  const li = row.invoice_line_items ?? row.invoiceLineItems ?? row.line_items ?? row.lineItems;
  if (!Array.isArray(li)) return null;
  return li;
}

function nestedTenant(row: Record<string, unknown>): Record<string, unknown> | null {
  const t = row.tenants ?? row.tenant;
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  return snakeRowToCamel(t as Record<string, unknown>) as Record<string, unknown>;
}

function stripInvoiceNestedKeys(row: Record<string, unknown>): Record<string, unknown> {
  const omit = new Set([
    "invoice_line_items",
    "invoiceLineItems",
    "line_items",
    "lineItems",
    "tenants",
    "tenant"
  ]);
  return Object.fromEntries(Object.entries(row).filter(([k]) => !omit.has(k)));
}

/**
 * Invoice + embedded line items + optional tenant (PostgREST / RPC shape).
 * Mirrors Express `presentInvoice` + Prisma `include: { lineItems, tenant }`.
 */
export function dbInvoiceBundleToClient(row: Record<string, unknown>): Record<string, unknown> {
  const rawLines = nestedLineItems(row);
  const lineItems = rawLines?.map((x) => mapLineItem(x as Record<string, unknown>)) ?? [];
  const tenant = nestedTenant(row);
  const base = dbInvoiceToClient(stripInvoiceNestedKeys(row));
  const out: Record<string, unknown> = { ...base, lineItems };
  if (tenant) out.tenant = tenant;
  return out;
}

export function rpcInvoiceCreateResultToClient(payload: Record<string, unknown>): Record<string, unknown> {
  const inv = payload.invoice ?? payload;
  const lines = (payload.line_items ?? payload.lineItems) as unknown;
  const synthetic = {
    ...(typeof inv === "object" && inv !== null ? (inv as Record<string, unknown>) : {}),
    line_items: Array.isArray(lines) ? lines : []
  };
  return dbInvoiceBundleToClient(synthetic);
}
