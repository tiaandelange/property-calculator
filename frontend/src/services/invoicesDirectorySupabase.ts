import { mapInvoiceDirectoryRow } from "../features/invoices/invoiceDirectoryAdapter";
import type { InvoiceDirectoryMetrics } from "../features/invoices/invoiceDirectoryTypes";
import { INVOICE_PAGE_SIZE } from "../features/invoices/invoiceDirectoryUtils";
import { getSupabase } from "../lib/supabaseClient";
import type { InvoiceDirectoryFilterParams, InvoicesDirectoryParams } from "../lib/queryKeys";

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === "object" && "message" in e) {
    const pe = e as { message?: string; hint?: string; details?: string };
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return new Error(String(e));
}

const EMPTY_METRICS: InvoiceDirectoryMetrics = {
  totalOutstanding: 0,
  dueThisMonth: 0,
  overdue: 0,
  paidThisMonth: 0
};

export type InvoicesDirectoryQueryOpts = InvoicesDirectoryParams;

function directoryRpcFilters(opts?: InvoicesDirectoryParams) {
  return {
    p_property_id:
      opts?.propertyId && opts.propertyId !== "ALL" ? String(opts.propertyId) : null,
    p_status: opts?.status && opts.status !== "ALL" ? String(opts.status) : null,
    p_date_from: opts?.dateFrom?.trim() || null,
    p_date_to: opts?.dateTo?.trim() || null,
    p_search: opts?.q?.trim() || null
  };
}

/** Lightweight portfolio invoice metrics (filtered set, no pagination). */
export async function getInvoiceDirectoryMetrics(
  opts?: InvoiceDirectoryFilterParams
): Promise<InvoiceDirectoryMetrics> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_invoice_directory_metrics", directoryRpcFilters(opts));
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return EMPTY_METRICS;
  }
  const payload = data as Record<string, unknown>;
  return {
    totalOutstanding: Number(payload.totalOutstanding ?? 0),
    dueThisMonth: Number(payload.dueThisMonth ?? 0),
    overdue: Number(payload.overdue ?? 0),
    paidThisMonth: Number(payload.paidThisMonth ?? 0)
  };
}

/** Paginated invoice directory list (metrics excluded). */
export async function getInvoicesDirectoryList(opts?: InvoicesDirectoryParams): Promise<{
  items: ReturnType<typeof mapInvoiceDirectoryRow>[];
  totalCount: number;
}> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? INVOICE_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_invoices_directory", {
    ...directoryRpcFilters(opts),
    p_limit: pageSize,
    p_offset: offset
  });
  if (error) throw toError(error);
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Empty invoices directory response.");
  }

  const payload = data as Record<string, unknown>;
  const rawItems = (payload.items ?? []) as Record<string, unknown>[];
  return {
    items: rawItems.map((row) => mapInvoiceDirectoryRow(row)),
    totalCount: Number(payload.totalCount ?? 0)
  };
}

/** @deprecated Use getInvoicesDirectoryList + getInvoiceDirectoryMetrics separately. */
export async function getInvoicesDirectory(opts?: InvoicesDirectoryQueryOpts) {
  const [list, metrics] = await Promise.all([
    getInvoicesDirectoryList(opts),
    getInvoiceDirectoryMetrics(opts)
  ]);
  return { ...list, metrics, properties: [] as Array<{ id: string; name: string }> };
}
