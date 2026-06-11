import type { PostgrestError } from "@supabase/supabase-js";
import { requireLocalUserId } from "../lib/authSession";
import { getSupabase } from "../lib/supabaseClient";
import {
  dbStatementBundleToClient,
  dbStatementToClient,
  rpcStatementCreateResultToClient
} from "../api/statementRowMapping";
import { isInvoiceEditable } from "../features/invoices/invoiceFoundation";

const STATEMENTS_BUCKET = "invoices";
const SIGNED_URL_TTL_SEC = 600;

async function attachSignedPdfDownloadUrl(
  mapped: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!mapped.hasPdf) return mapped;
  const bucket = String(mapped.pdfStorageBucket ?? STATEMENTS_BUCKET);
  const key = mapped.pdfStorageKey != null ? String(mapped.pdfStorageKey) : "";
  if (!key.trim()) return mapped;
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(key, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return mapped;
  return { ...mapped, downloadUrl: data.signedUrl };
}

function toError(e: PostgrestError | Error): Error {
  if ("code" in e && "message" in e) {
    const pe = e as PostgrestError;
    const parts = [pe.message, pe.hint, pe.details].filter(Boolean);
    return new Error(parts.join(" — ") || "Database request failed.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function toIsoDate(v: unknown): string {
  if (v == null || v === "") return new Date().toISOString();
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return `${v.trim()}T12:00:00.000Z`;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeLineItems(input: Record<string, unknown>): Record<string, unknown>[] {
  const raw = input.lineItems ?? input.line_items;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const o = item as Record<string, unknown>;
    const qty = n(o.quantity ?? 1);
    const unitPrice = n(o.unitPrice ?? o.unit_price);
    const total = n(o.total ?? qty * unitPrice);
    return {
      description: String(o.description ?? ""),
      quantity: qty,
      unit_price: unitPrice,
      total,
      entry_type: String(o.entryType ?? o.entry_type ?? "DEBIT").toUpperCase(),
      category: o.category != null ? String(o.category) : null,
      transaction_date: o.transactionDate ?? o.transaction_date ?? null,
      sort_order: o.sortOrder ?? o.sort_order ?? index + 1
    };
  });
}

const STATEMENT_DETAIL_SELECT = `
  *,
  tenant_statement_line_items (*),
  tenants ( id, first_name, last_name, email, phone ),
  properties ( id, name ),
  leases ( id, start_date, fixed_term_end_date, status, lease_reference, deposit_amount )
`;

export async function getTenantStatement(id: string | number): Promise<Record<string, unknown>> {
  await requireLocalUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tenant_statement_documents")
    .select(STATEMENT_DETAIL_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) throw new Error("Statement not found");
  return attachSignedPdfDownloadUrl(dbStatementBundleToClient(data as Record<string, unknown>));
}

export async function createTenantStatement(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await requireLocalUserId();
  const tenantId = input.tenantId ?? input.tenant_id;
  if (tenantId == null || tenantId === "") throw new Error("tenantId is required.");

  const lineItems = normalizeLineItems(input);
  if (lineItems.length === 0) throw new Error("At least one line item is required.");

  const leaseRaw = input.leaseId ?? input.lease_id;
  const leaseId = leaseRaw != null && String(leaseRaw).trim() !== "" ? String(leaseRaw) : null;

  const pStatementData: Record<string, unknown> = {
    statement_type: String(input.statementType ?? input.statement_type ?? "FINANCIAL").toUpperCase(),
    statement_date: toIsoDate(input.statementDate ?? input.statement_date ?? input.issueDate),
    period_start: input.periodStart ?? input.period_start ?? null,
    period_end: input.periodEnd ?? input.period_end ?? null,
    opening_balance: input.openingBalance != null ? n(input.openingBalance) : n(input.opening_balance),
    status: String(input.status ?? "DRAFT"),
    notes: input.notes != null ? String(input.notes) : null,
    total: input.total != null ? n(input.total) : undefined,
    subtotal: input.subtotal != null ? n(input.subtotal) : undefined
  };

  const sb = getSupabase();
  const { data, error } = await sb.rpc("create_tenant_statement_with_line_items", {
    p_property_id: String(propertyId),
    p_tenant_id: String(tenantId),
    p_lease_id: leaseId,
    p_statement_data: pStatementData,
    p_line_items: lineItems
  });
  if (error) throw toError(error);
  return rpcStatementCreateResultToClient(data as Record<string, unknown>);
}

export async function updateTenantStatement(
  id: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await requireLocalUserId();
  const sb = getSupabase();
  const hasLineKey =
    Object.prototype.hasOwnProperty.call(input, "lineItems") ||
    Object.prototype.hasOwnProperty.call(input, "line_items");
  const lineItems = hasLineKey ? normalizeLineItems(input) : null;

  const pData: Record<string, unknown> = {};
  if (input.statementDate != null || input.statement_date != null) {
    pData.statement_date = toIsoDate(input.statementDate ?? input.statement_date);
  }
  if (input.periodStart !== undefined || input.period_start !== undefined) {
    pData.period_start = input.periodStart ?? input.period_start;
  }
  if (input.periodEnd !== undefined || input.period_end !== undefined) {
    pData.period_end = input.periodEnd ?? input.period_end;
  }
  if (input.openingBalance !== undefined || input.opening_balance !== undefined) {
    pData.opening_balance = n(input.openingBalance ?? input.opening_balance);
  }
  if (input.status != null) pData.status = String(input.status);
  if (input.notes !== undefined) pData.notes = input.notes == null ? null : String(input.notes);

  if (hasLineKey) {
    const { data, error } = await sb.rpc("update_tenant_statement_with_line_items", {
      p_statement_id: String(id),
      p_statement_data: pData,
      p_line_items: lineItems
    });
    if (error) throw toError(error);
    return getTenantStatement(id);
  }

  if (Object.keys(pData).length === 0) return getTenantStatement(id);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (pData.statement_date != null) patch.statement_date = pData.statement_date;
  if (pData.period_start !== undefined) patch.period_start = pData.period_start;
  if (pData.period_end !== undefined) patch.period_end = pData.period_end;
  if (pData.opening_balance !== undefined) patch.opening_balance = pData.opening_balance;
  if (pData.status != null) patch.status = pData.status;
  if (pData.notes !== undefined) patch.notes = pData.notes;

  const { error } = await sb.from("tenant_statement_documents").update(patch).eq("id", String(id));
  if (error) throw toError(error);
  return getTenantStatement(id);
}

export async function deleteTenantStatement(id: string | number): Promise<{ message: string }> {
  const uid = await requireLocalUserId();
  const sb = getSupabase();
  const { data: row } = await sb
    .from("tenant_statement_documents")
    .select("pdf_storage_bucket,pdf_storage_key")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (row?.pdf_storage_key && row?.pdf_storage_bucket) {
    await sb.storage.from(String(row.pdf_storage_bucket)).remove([String(row.pdf_storage_key)]);
  }
  const { data, error } = await sb.rpc("hard_delete_tenant_statement", { p_id: String(id) });
  if (error) throw toError(error);
  const r = (data ?? {}) as { message?: string };
  return { message: typeof r.message === "string" ? r.message : "Deleted" };
}

export async function markTenantStatementSent(id: string | number): Promise<Record<string, unknown>> {
  const uid = await requireLocalUserId();
  const sb = getSupabase();
  const { data: existing, error: fetchErr } = await sb
    .from("tenant_statement_documents")
    .select("id, status")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (fetchErr) throw toError(fetchErr);
  if (!existing) throw new Error("Statement not found");
  if (!isInvoiceEditable(existing.status)) {
    throw new Error("Statement cannot be marked as sent in its current status.");
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("tenant_statement_documents")
    .update({ status: "SENT", sent_at: now, updated_at: now })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbStatementToClient(data as Record<string, unknown>);
}
