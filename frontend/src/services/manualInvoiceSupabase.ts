import { getSupabase } from "../lib/supabaseClient";
import { isUuid } from "../utils/propertyIds";
import type { ManualInvoiceType } from "../features/leases/leaseBillingPeriodUtils";

function toError(e: { message?: string; hint?: string; details?: string }): Error {
  const parts = [e.message, e.hint, e.details].filter(Boolean);
  return new Error(parts.join(" — ") || "Operation failed.");
}

export type ManualGenerateLeaseInvoiceResult = {
  ok: boolean;
  duplicate?: boolean;
  message?: string;
  invoiceId?: string;
  tenantId?: string;
  propertyId?: string;
};

export async function manualGenerateLeaseInvoice(input: {
  leaseId: string;
  invoicePeriod: string;
  invoiceType: ManualInvoiceType;
  dueDate: string;
  amount: number;
  notes?: string | null;
}): Promise<ManualGenerateLeaseInvoiceResult> {
  const leaseId = String(input.leaseId);
  if (!isUuid(leaseId)) throw new Error("Lease id must be a UUID.");

  const sb = getSupabase();
  const { data, error } = await sb.rpc("manual_generate_lease_invoice", {
    p_lease_id: leaseId,
    p_invoice_period: input.invoicePeriod,
    p_invoice_type: input.invoiceType,
    p_due_date: input.dueDate,
    p_amount: input.amount,
    p_notes: input.notes?.trim() ? input.notes.trim() : null
  });
  if (error) throw toError(error);

  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    ok: raw.ok === true,
    duplicate: raw.duplicate === true,
    message: raw.message != null ? String(raw.message) : undefined,
    invoiceId: raw.invoiceId != null ? String(raw.invoiceId) : raw.invoice_id != null ? String(raw.invoice_id) : undefined,
    tenantId: raw.tenantId != null ? String(raw.tenantId) : raw.tenant_id != null ? String(raw.tenant_id) : undefined,
    propertyId:
      raw.propertyId != null ? String(raw.propertyId) : raw.property_id != null ? String(raw.property_id) : undefined
  };
}
