import { listPropertyOptions } from "./propertiesSupabase";
import { listInvoicesDirectory } from "./invoicesSupabase";
import { mapInvoiceDirectoryRow } from "../features/invoices/invoiceDirectoryAdapter";
import type { InvoicesDirectoryResult } from "../features/invoices/invoiceDirectoryTypes";
import { computeInvoiceMetrics, INVOICE_PAGE_SIZE } from "../features/invoices/invoiceDirectoryUtils";
import type { InvoicesDirectoryParams } from "../lib/queryKeys";

const EMPTY_METRICS = {
  totalOutstanding: 0,
  dueThisMonth: 0,
  overdue: 0,
  paidThisMonth: 0
};

export type InvoicesDirectoryQueryOpts = InvoicesDirectoryParams;

/** Portfolio-wide invoice directory with server-side pagination. */
export async function getInvoicesDirectory(
  opts?: InvoicesDirectoryQueryOpts
): Promise<InvoicesDirectoryResult & { totalCount: number }> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? INVOICE_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const filters = {
    propertyId: opts?.propertyId && opts.propertyId !== "ALL" ? String(opts.propertyId) : null,
    status: opts?.status && opts.status !== "ALL" ? String(opts.status) : null,
    dateFrom: opts?.dateFrom?.trim() || null,
    dateTo: opts?.dateTo?.trim() || null,
    q: opts?.q?.trim() || null,
    limit: pageSize,
    offset
  };

  const [pageResult, props] = await Promise.all([
    listInvoicesDirectory(filters),
    listPropertyOptions()
  ]);

  const pageItems = pageResult.rows.map((row) => mapInvoiceDirectoryRow(row as Record<string, unknown>));

  const metricsRows =
    pageResult.metricsRows?.map((row) => mapInvoiceDirectoryRow(row as Record<string, unknown>)) ?? pageItems;

  return {
    items: pageItems,
    totalCount: pageResult.totalCount,
    metrics: computeInvoiceMetrics(metricsRows),
    properties: props.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? "Property")
    }))
  };
}
