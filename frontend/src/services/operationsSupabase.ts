import { getSupabase } from "../lib/supabaseClient";
import { isUuid } from "../utils/propertyIds";

function toError(e: { message?: string; hint?: string; details?: string }): Error {
  const parts = [e.message, e.hint, e.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Operation failed.");
}

export type CreateInvoiceFromLeaseResult = {
  ok: boolean;
  message?: string;
  invoiceId?: string;
};

/** RPC `create_invoice_from_lease` — draft invoice for active lease in current UTC month. */
export async function createInvoiceFromLease(
  propertyId: string,
  leaseId?: string | null
): Promise<CreateInvoiceFromLeaseResult> {
  const pid = String(propertyId);
  if (!isUuid(pid)) throw new Error("Property id must be a UUID.");

  const sb = getSupabase();
  const { data, error } = await sb.rpc("create_invoice_from_lease", {
    p_property_id: pid,
    p_lease_id: leaseId && isUuid(String(leaseId)) ? String(leaseId) : null
  });
  if (error) throw toError(error);
  const payload = (data ?? {}) as CreateInvoiceFromLeaseResult;
  if (payload.ok === false) {
    throw new Error(payload.message ?? "Could not create invoice from lease.");
  }
  return payload;
}

export type FinancialBackfillResult = {
  ok?: boolean;
  monthsProcessed?: number;
  incomeEntriesCreated?: number;
  expenseEntriesCreated?: number;
  skippedDuplicates?: number;
  message?: string;
};

/** RPC `run_financial_historical_backfill`. */
export async function runFinancialHistoricalBackfill(
  propertyId: string,
  payload: Record<string, unknown>
): Promise<FinancialBackfillResult> {
  const pid = String(propertyId);
  if (!isUuid(pid)) throw new Error("Property id must be a UUID.");

  const sb = getSupabase();
  const { data, error } = await sb.rpc("run_financial_historical_backfill", {
    p_property_id: pid,
    p_payload: payload
  });
  if (error) throw toError(error);
  return (data ?? {}) as FinancialBackfillResult;
}
