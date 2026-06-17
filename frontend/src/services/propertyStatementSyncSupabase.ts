import { getSupabase } from "../lib/supabaseClient";
import { isUuid } from "../utils/propertyIds";
import { runDueRecurringExpensesForProperty } from "./bondOperationsVercel";
import { generateDueLeaseInvoices } from "./invoiceAutomationSupabase";
import { requireUserId } from "./profileSupabase";

export type PropertyStatementSyncResult = {
  recurringExpenseLinesCreated: number;
  bondLinesCreated: number;
  incomeLinesCreated: number;
  invoicesCreated: number;
  skippedDuplicates: number;
  syncedAt: string;
  hadChanges: boolean;
};

/**
 * Idempotent sync for property statement sources: recurring expenses (incl. bond),
 * and due lease invoices (statement income appears via existing statement RPCs).
 */
export async function syncPropertyStatementLines(params: {
  propertyId: string;
  today?: string;
}): Promise<PropertyStatementSyncResult> {
  const propertyId = String(params.propertyId ?? "").trim();
  if (!isUuid(propertyId)) {
    throw new Error("Property id must be a UUID.");
  }

  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: property, error: propertyError } = await sb
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", uid)
    .maybeSingle();

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (!property) {
    throw new Error("Property not found or access denied.");
  }

  const syncedAt = params.today ?? new Date().toISOString().slice(0, 10);

  const [recurringResult, invoiceResult] = await Promise.all([
    runDueRecurringExpensesForProperty(propertyId),
    generateDueLeaseInvoices({ propertyId })
  ]);

  const recurringExpenseLinesCreated = recurringResult.createdCount;
  const invoicesCreated = invoiceResult.invoicesCreated;
  const skippedDuplicates =
    invoiceResult.skippedDuplicate +
    invoiceResult.skippedInactive +
    invoiceResult.skippedNotDue +
    (invoiceResult.skippedOutsideLease ?? 0) +
    (invoiceResult.skippedAutoDisabled ?? 0);
  const hadChanges = recurringExpenseLinesCreated > 0 || invoicesCreated > 0;

  return {
    recurringExpenseLinesCreated,
    bondLinesCreated: 0,
    incomeLinesCreated: invoicesCreated,
    invoicesCreated,
    skippedDuplicates,
    syncedAt,
    hadChanges
  };
}
