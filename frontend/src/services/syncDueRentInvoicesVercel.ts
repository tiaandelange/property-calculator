import { authFetch } from "../lib/authFetch";
import { isUuid } from "../utils/propertyIds";
import type { SyncDueRentInvoicesSummary } from "../../api/_lib/syncDueRentInvoicesServer";

export type { SyncDueRentInvoicesSummary };

export async function syncDueRentInvoicesForPropertyViaVercel(
  propertyId: string,
  opts?: { today?: string }
): Promise<SyncDueRentInvoicesSummary> {
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");
  return authFetch(`/api/properties/${encodeURIComponent(propertyId)}/sync-due-rent-invoices`, {
    method: "POST",
    body: JSON.stringify(opts?.today ? { today: opts.today } : {})
  }) as Promise<SyncDueRentInvoicesSummary>;
}
