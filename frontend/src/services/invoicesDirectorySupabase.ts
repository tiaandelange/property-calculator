import { listProperties } from "./propertiesSupabase";
import { listInvoicesDirectory } from "./invoicesSupabase";
import { mapInvoiceDirectoryRow } from "../features/invoices/invoiceDirectoryAdapter";
import type { InvoicesDirectoryResult } from "../features/invoices/invoiceDirectoryTypes";
import { computeInvoiceMetrics } from "../features/invoices/invoiceDirectoryUtils";

const EMPTY_METRICS = {
  totalOutstanding: 0,
  dueThisMonth: 0,
  overdue: 0,
  paidThisMonth: 0
};

/** Portfolio-wide invoice directory from global `public.invoices` (RLS: user_id). */
export async function getInvoicesDirectory(): Promise<InvoicesDirectoryResult> {
  const [rawRows, props] = await Promise.all([listInvoicesDirectory(), listProperties()]);
  const items = rawRows.map((row) => mapInvoiceDirectoryRow(row as Record<string, unknown>));
  const properties = props.map((p) => ({
    id: String(p.id),
    name: String(p.name ?? "Property")
  }));
  return {
    items,
    metrics: computeInvoiceMetrics(items),
    properties
  };
}
