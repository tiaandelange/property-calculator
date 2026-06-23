import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncDueRentInvoicesSummary = {
  invoicesCreated: number;
  statementLinesCreated: number;
  invoicesSkippedExisting: number;
  linesSkippedExisting: number;
  leasesSkippedNotInWindow: number;
  leasesSkippedInactive: number;
  leasesChecked: number;
  skippedAutoDisabled: number;
  skippedOutsideLease: number;
  errors: Array<{ leaseId?: string; propertyId?: string; message: string }>;
  asOfDate: string;
  timezone: string;
};

function mapRpcSummary(raw: Record<string, unknown>): SyncDueRentInvoicesSummary {
  const errorsRaw = raw.errors;
  const errors = Array.isArray(errorsRaw)
    ? errorsRaw.map((e) => {
        const o = e as Record<string, unknown>;
        return {
          leaseId: o.lease_id != null ? String(o.lease_id) : o.leaseId != null ? String(o.leaseId) : undefined,
          propertyId:
            o.property_id != null ? String(o.property_id) : o.propertyId != null ? String(o.propertyId) : undefined,
          message: String(o.message ?? "Unknown error")
        };
      })
    : [];

  const skippedDup = Number(raw.skipped_duplicate ?? raw.skippedDuplicate ?? 0);
  const skippedInactive = Number(raw.skipped_inactive ?? raw.skippedInactive ?? 0);
  const skippedNotDue = Number(raw.skipped_not_due ?? raw.skippedNotDue ?? 0);
  const skippedOutside = Number(raw.skipped_outside_lease ?? raw.skippedOutsideLease ?? 0);
  const skippedAuto = Number(raw.skipped_auto_disabled ?? raw.skippedAutoDisabled ?? 0);
  const invoicesCreated = Number(raw.invoices_created ?? raw.invoicesCreated ?? 0);
  const statementLinesCreated = Number(
    raw.statement_lines_created ?? raw.statementLinesCreated ?? invoicesCreated
  );

  return {
    invoicesCreated,
    statementLinesCreated,
    invoicesSkippedExisting: skippedDup,
    linesSkippedExisting: skippedDup,
    leasesSkippedNotInWindow: skippedNotDue,
    leasesSkippedInactive: skippedInactive + skippedOutside + skippedAuto,
    leasesChecked: Number(raw.leases_checked ?? raw.leasesChecked ?? 0),
    skippedAutoDisabled: skippedAuto,
    skippedOutsideLease: skippedOutside,
    errors,
    asOfDate: String(raw.as_of_date ?? raw.asOfDate ?? ""),
    timezone: String(raw.timezone ?? "")
  };
}

async function assertPropertyAccess(sb: SupabaseClient, uid: string, propertyId: string): Promise<void> {
  const { data, error } = await sb
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Property not found or access denied.");
}

/**
 * Idempotent catch-up for due rent invoices on a property.
 * Invoices surface on the property statement via existing statement RPCs (no duplicate income rows).
 */
export async function syncDueRentInvoicesForUserProperty(params: {
  sb: SupabaseClient;
  userId: string;
  propertyId: string;
  today?: string;
}): Promise<SyncDueRentInvoicesSummary> {
  const propertyId = String(params.propertyId ?? "").trim();
  if (!propertyId) throw new Error("propertyId is required.");

  await assertPropertyAccess(params.sb, params.userId, propertyId);

  const rpcArgs: { p_as_of?: string; p_property_id: string } = { p_property_id: propertyId };
  if (params.today) rpcArgs.p_as_of = params.today;

  const { data, error } = await params.sb.rpc("generate_due_lease_invoices", rpcArgs);
  if (error) throw new Error(error.message);

  return mapRpcSummary((data ?? {}) as Record<string, unknown>);
}
