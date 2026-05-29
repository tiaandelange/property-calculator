import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  dbInvoiceBundleToClient,
  dbInvoiceToClient,
  rpcInvoiceCreateResultToClient
} from "../api/invoiceRowMapping";

const INVOICES_BUCKET = "invoices";
const SIGNED_URL_TTL_SEC = 600;

async function attachSignedPdfDownloadUrl(
  mapped: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!mapped.hasPdf) return mapped;
  const bucket = String(mapped.pdfStorageBucket ?? INVOICES_BUCKET);
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

async function requireUserId(): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error) throw toError(error);
  if (!data.user?.id) throw new Error("Not signed in.");
  return data.user.id;
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
    const qty = n(o.quantity ?? o.qty ?? 1);
    const unitPrice = n(o.unitPrice ?? o.unit_price);
    const total = n(o.total ?? o.amount ?? qty * unitPrice);
    const row: Record<string, unknown> = {
      description: String(o.description ?? ""),
      quantity: qty,
      unit_price: unitPrice,
      total,
      sort_order: o.sortOrder ?? o.sort_order ?? index + 1
    };
    if (o.category != null) row.category = String(o.category);
    return row;
  });
}

const INVOICE_LIST_SELECT = `
  *,
  invoice_line_items (*)
`;

const INVOICE_DETAIL_SELECT = `
  *,
  invoice_line_items (*),
  tenants ( id, first_name, last_name, email, phone )
`;

const INVOICE_DIRECTORY_SELECT = `
  id,
  user_id,
  property_id,
  tenant_id,
  lease_id,
  unit_id,
  invoice_number,
  invoice_type,
  invoice_period,
  invoice_date,
  issue_date,
  due_date,
  status,
  total,
  total_amount,
  balance_due,
  paid_at,
  created_at,
  pdf_storage_key,
  pdf_storage_bucket,
  tenants ( id, first_name, last_name ),
  properties ( id, name ),
  property_units ( id, unit_label, unit_number ),
  leases ( id, start_date, fixed_term_end_date, status )
`;

export async function listInvoicesDirectory(): Promise<Record<string, unknown>[]> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select(INVOICE_DIRECTORY_SELECT)
    .eq("user_id", uid)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return data ?? [];
}

export async function voidInvoice(id: string | number): Promise<Record<string, unknown>> {
  return updateInvoice(id, { status: "VOID" });
}

export async function listInvoices(
  propertyId: string | number,
  filters?: {
    tenantId?: string;
    leaseId?: string;
    unitId?: string;
    status?: string | string[];
    invoiceType?: string;
    invoicePeriod?: string;
  }
): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  let query = sb
    .from("invoices")
    .select(INVOICE_LIST_SELECT)
    .eq("property_id", String(propertyId));
  if (filters?.tenantId) query = query.eq("tenant_id", filters.tenantId);
  if (filters?.leaseId) query = query.eq("lease_id", filters.leaseId);
  if (filters?.unitId) query = query.eq("unit_id", filters.unitId);
  if (filters?.invoiceType) query = query.eq("invoice_type", filters.invoiceType);
  if (filters?.invoicePeriod) query = query.eq("invoice_period", filters.invoicePeriod);
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("status", statuses.map((s) => String(s).toUpperCase()));
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw toError(error);
  const mapped = (data ?? []).map((r) => dbInvoiceBundleToClient(r as Record<string, unknown>));
  return Promise.all(mapped.map((row) => attachSignedPdfDownloadUrl(row)));
}

export async function getInvoice(id: string | number): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select(INVOICE_DETAIL_SELECT)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) throw new Error("Invoice not found");
  return attachSignedPdfDownloadUrl(dbInvoiceBundleToClient(data as Record<string, unknown>));
}

export async function createInvoice(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await requireUserId();
  const tenantId = input.tenantId ?? input.tenant_id;
  if (tenantId == null || tenantId === "") throw new Error("tenantId is required.");

  const lineItems = normalizeLineItems(input);
  if (lineItems.length === 0) throw new Error("At least one line item is required.");

  const leaseRaw = input.leaseId ?? input.lease_id;
  const leaseId = leaseRaw != null && String(leaseRaw).trim() !== "" ? String(leaseRaw) : null;

  const pInvoiceData: Record<string, unknown> = {
    invoice_date: toIsoDate(input.invoiceDate ?? input.invoice_date ?? input.issueDate ?? input.issue_date),
    issue_date: toIsoDate(input.issueDate ?? input.issue_date ?? input.invoiceDate ?? input.invoice_date),
    due_date: toIsoDate(input.dueDate ?? input.due_date),
    status: String(input.status ?? "DRAFT"),
    notes: input.notes != null ? String(input.notes) : null,
    total: input.total != null ? n(input.total) : input.totalAmount != null ? n(input.totalAmount) : undefined,
    subtotal: input.subtotal != null ? n(input.subtotal) : undefined,
    tax_amount: input.taxAmount != null ? n(input.taxAmount) : input.tax_amount != null ? n(input.tax_amount) : undefined,
    invoice_type: String(input.invoiceType ?? input.invoice_type ?? "MANUAL"),
    invoice_period: input.invoicePeriod ?? input.invoice_period
  };
  if (input.invoiceNumber != null || input.invoice_number != null) {
    pInvoiceData.invoice_number = String(input.invoiceNumber ?? input.invoice_number ?? "").trim();
    if (pInvoiceData.invoice_number === "") delete pInvoiceData.invoice_number;
  }

  const sb = getSupabase();
  const { data, error } = await sb.rpc("create_invoice_with_line_items", {
    p_property_id: String(propertyId),
    p_tenant_id: String(tenantId),
    p_lease_id: leaseId,
    p_invoice_data: pInvoiceData,
    p_line_items: lineItems
  });
  if (error) throw toError(error);
  const payload = data as Record<string, unknown>;
  return rpcInvoiceCreateResultToClient(payload);
}

export async function updateInvoice(
  id: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const hasLineKey = Object.prototype.hasOwnProperty.call(input, "lineItems")
    || Object.prototype.hasOwnProperty.call(input, "line_items");
  const lineItems = hasLineKey ? normalizeLineItems(input) : null;

  const pData: Record<string, unknown> = {};
  if (input.invoiceDate != null || input.invoice_date != null) {
    pData.invoice_date = toIsoDate(input.invoiceDate ?? input.invoice_date);
  }
  if (input.dueDate != null || input.due_date != null) {
    pData.due_date = toIsoDate(input.dueDate ?? input.due_date);
  }
  if (input.status != null) pData.status = String(input.status);
  if (input.notes !== undefined) pData.notes = input.notes == null ? null : String(input.notes);
  if (input.total !== undefined) pData.total = n(input.total);
  if (input.subtotal !== undefined) pData.subtotal = n(input.subtotal);
  if (input.tenantId !== undefined || input.tenant_id !== undefined) {
    const tid = input.tenantId ?? input.tenant_id;
    pData.tenant_id = tid != null && tid !== "" ? String(tid) : null;
  }
  if (input.leaseId !== undefined || input.lease_id !== undefined) {
    const lid = input.leaseId ?? input.lease_id;
    pData.lease_id = lid != null && String(lid).trim() !== "" ? String(lid) : null;
  }

  if (hasLineKey) {
    const rpcPayload: Record<string, unknown> = { ...pData };
    if (input.total !== undefined) rpcPayload.total = n(input.total);
    const { data, error } = await sb.rpc("update_invoice_with_line_items", {
      p_invoice_id: String(id),
      p_invoice_data: rpcPayload,
      p_line_items: lineItems
    });
    if (error) throw toError(error);
    return rpcInvoiceCreateResultToClient(data as Record<string, unknown>);
  }

  if (Object.keys(pData).length === 0) {
    return getInvoice(id);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (pData.invoice_date != null) patch.invoice_date = pData.invoice_date;
  if (pData.due_date != null) patch.due_date = pData.due_date;
  if (pData.status != null) patch.status = pData.status;
  if (pData.notes !== undefined) patch.notes = pData.notes;
  if (pData.total !== undefined) patch.total = pData.total;
  if (pData.subtotal !== undefined) patch.subtotal = pData.subtotal;
  if (pData.tenant_id !== undefined) patch.tenant_id = pData.tenant_id;
  if (pData.lease_id !== undefined) patch.lease_id = pData.lease_id;

  const { data, error } = await sb
    .from("invoices")
    .update(patch)
    .eq("id", String(id))
    .select("id")
    .maybeSingle();
  if (error) throw toError(error);
  if (!data) throw new Error("Invoice not found");
  return getInvoice(id);
}

export async function deleteInvoice(id: string | number): Promise<{ message: string }> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: row } = await sb
    .from("invoices")
    .select("pdf_storage_bucket,pdf_storage_key")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (row?.pdf_storage_key && row?.pdf_storage_bucket) {
    await sb.storage.from(String(row.pdf_storage_bucket)).remove([String(row.pdf_storage_key)]);
  }
  const { data, error } = await sb.rpc("hard_delete_invoice", { p_id: String(id) });
  if (error) throw toError(error);
  const r = (data ?? {}) as { message?: string };
  return { message: typeof r.message === "string" ? r.message : "Deleted" };
}

export async function markInvoicePaid(id: string | number): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("invoices")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbInvoiceToClient(data as Record<string, unknown>);
}
