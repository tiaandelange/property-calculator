import { snakeRowToCamel } from "./propertyRowMapping";

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
  return {
    ...c,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt
  };
}

/** One invoice row from `invoices` (snake_case or camel). */
export function dbInvoiceToClient(row: Record<string, unknown>): Record<string, unknown> {
  const c = snakeRowToCamel(row) as Record<string, unknown>;
  const pdfRaw = c.pdfPath ?? (row as Record<string, unknown>).pdf_path;
  const id = c.id;
  const hasPdf = Boolean(pdfRaw && String(pdfRaw).trim() !== "");
  const core = { ...c } as Record<string, unknown>;
  delete core.pdfPath;
  delete core.pdf_path;
  return {
    ...core,
    id,
    invoiceDate: c.invoiceDate != null ? coerceIsoDateField(c.invoiceDate) : c.invoiceDate,
    dueDate: c.dueDate != null ? coerceIsoDateField(c.dueDate) : c.dueDate,
    createdAt: c.createdAt != null ? coerceIsoDateField(c.createdAt) : c.createdAt,
    updatedAt: c.updatedAt != null ? coerceIsoDateField(c.updatedAt) : c.updatedAt,
    sentAt: c.sentAt != null ? coerceIsoDateField(c.sentAt) : c.sentAt,
    paidAt: c.paidAt != null ? coerceIsoDateField(c.paidAt) : c.paidAt,
    archivedAt: c.archivedAt != null ? coerceIsoDateField(c.archivedAt) : c.archivedAt,
    hasPdf,
    downloadUrl: hasPdf && id != null ? `/api/invoices/${id}/download` : null
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
