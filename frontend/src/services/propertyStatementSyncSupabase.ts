import { isUuid } from "../utils/propertyIds";
import { runDueRecurringExpensesForProperty } from "./bondOperationsVercel";
import { syncDueRentInvoicesForPropertyViaVercel, type SyncDueRentInvoicesSummary } from "./syncDueRentInvoicesVercel";
import { getSupabase } from "../lib/supabaseClient";
import { generateDueLeaseInvoices } from "./invoiceAutomationSupabase";
import { requireUserId } from "./profileSupabase";

export type PropertyStatementSyncResult = {
  recurringExpenseLinesCreated: number;
  bondLinesCreated: number;
  incomeLinesCreated: number;
  invoicesCreated: number;
  statementLinesCreated: number;
  invoicesSkippedExisting: number;
  linesSkippedExisting: number;
  leasesSkippedNotInWindow: number;
  leasesSkippedInactive: number;
  skippedDuplicates: number;
  syncedAt: string;
  hadChanges: boolean;
  rentInvoiceSync: SyncDueRentInvoicesSummary;
};

const inflightByProperty = new Map<string, Promise<PropertyStatementSyncResult>>();

function mapInvoiceSyncToStatementResult(
  invoiceResult: SyncDueRentInvoicesSummary,
  recurringExpenseLinesCreated: number,
  syncedAt: string
): PropertyStatementSyncResult {
  const hadChanges = recurringExpenseLinesCreated > 0 || invoiceResult.invoicesCreated > 0;
  return {
    recurringExpenseLinesCreated,
    bondLinesCreated: 0,
    incomeLinesCreated: invoiceResult.invoicesCreated,
    invoicesCreated: invoiceResult.invoicesCreated,
    statementLinesCreated: invoiceResult.statementLinesCreated,
    invoicesSkippedExisting: invoiceResult.invoicesSkippedExisting,
    linesSkippedExisting: invoiceResult.linesSkippedExisting,
    leasesSkippedNotInWindow: invoiceResult.leasesSkippedNotInWindow,
    leasesSkippedInactive: invoiceResult.leasesSkippedInactive,
    skippedDuplicates:
      invoiceResult.invoicesSkippedExisting +
      invoiceResult.leasesSkippedInactive +
      invoiceResult.leasesSkippedNotInWindow,
    syncedAt,
    hadChanges,
    rentInvoiceSync: invoiceResult
  };
}

async function runRentInvoiceSync(propertyId: string, today?: string): Promise<SyncDueRentInvoicesSummary> {
  try {
    return await syncDueRentInvoicesForPropertyViaVercel(propertyId, today ? { today } : undefined);
  } catch (apiErr) {
    if (import.meta.env.DEV) {
      console.warn("[propertyStatementSync] Vercel sync failed, falling back to Supabase RPC:", apiErr);
    }
    const legacy = await generateDueLeaseInvoices({ propertyId, asOf: today });
    return {
      invoicesCreated: legacy.invoicesCreated,
      statementLinesCreated: legacy.invoicesCreated,
      invoicesSkippedExisting: legacy.skippedDuplicate,
      linesSkippedExisting: legacy.skippedDuplicate,
      leasesSkippedNotInWindow: legacy.skippedNotDue,
      leasesSkippedInactive:
        legacy.skippedInactive + (legacy.skippedOutsideLease ?? 0) + (legacy.skippedAutoDisabled ?? 0),
      leasesChecked: legacy.leasesChecked,
      skippedAutoDisabled: legacy.skippedAutoDisabled ?? 0,
      skippedOutsideLease: legacy.skippedOutsideLease ?? 0,
      errors: legacy.errors,
      asOfDate: legacy.asOfDate,
      timezone: legacy.timezone
    };
  }
}

/**
 * Idempotent sync for property statement sources: recurring expenses and due lease rent invoices.
 * Rent invoices appear on the statement via existing invoice-backed statement RPCs.
 */
export async function syncDueRentInvoicesForUserProperty(params: {
  userId: string;
  propertyId: string;
  today?: string;
}): Promise<SyncDueRentInvoicesSummary> {
  const propertyId = String(params.propertyId ?? "").trim();
  if (!isUuid(propertyId)) throw new Error("Property id must be a UUID.");

  const uid = String(params.userId ?? "").trim();
  if (!uid) throw new Error("userId is required.");

  const sb = getSupabase();
  const { data: property, error } = await sb
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!property) throw new Error("Property not found or access denied.");

  return runRentInvoiceSync(propertyId, params.today);
}

export async function syncPropertyStatementLines(params: {
  propertyId: string;
  today?: string;
}): Promise<PropertyStatementSyncResult> {
  const propertyId = String(params.propertyId ?? "").trim();
  if (!isUuid(propertyId)) {
    throw new Error("Property id must be a UUID.");
  }

  const existing = inflightByProperty.get(propertyId);
  if (existing) return existing;

  const work = (async () => {
    await requireUserId();
    const syncedAt = params.today ?? new Date().toISOString().slice(0, 10);

    const [recurringResult, invoiceResult] = await Promise.all([
      runDueRecurringExpensesForProperty(propertyId),
      runRentInvoiceSync(propertyId, params.today)
    ]);

    await repairRentInvoices(propertyId).catch(() => undefined);

    return mapInvoiceSyncToStatementResult(invoiceResult, recurringResult.createdCount, syncedAt);
  })().finally(() => {
    inflightByProperty.delete(propertyId);
  });

  inflightByProperty.set(propertyId, work);
  return work;
}

/** Dev/audit: missing rent invoices in the current generation window for a property. */
export async function auditMissingRentInvoices(propertyId?: string): Promise<unknown[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("audit_missing_rent_invoices", {
    p_property_id: propertyId ?? null
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

/** Dev/audit: suspicious rent invoices (early, duplicate, outside lease window). */
export async function auditSuspiciousRentInvoices(propertyId?: string): Promise<unknown[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("audit_suspicious_rent_invoices", {
    p_property_id: propertyId ?? null
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

/** Dev/audit: repair draft/generated rent invoices missing line items. */
export async function repairRentInvoices(propertyId?: string): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("repair_rent_invoices", {
    p_property_id: propertyId ?? null
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, unknown>;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { proplyticRentInvoiceAudit?: Record<string, unknown> }).proplyticRentInvoiceAudit = {
    auditMissingRentInvoices,
    auditSuspiciousRentInvoices,
    repairRentInvoices,
    syncPropertyStatementLines
  };
}
