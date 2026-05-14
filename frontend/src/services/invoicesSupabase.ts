import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  dbInvoiceBundleToClient,
  dbInvoiceToClient,
  rpcInvoiceCreateResultToClient
} from "../api/invoiceRowMapping";

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
  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    const qty = n(o.quantity ?? o.qty ?? 1);
    const unitPrice = n(o.unitPrice ?? o.unit_price);
    const total = n(o.total ?? qty * unitPrice);
    return {
      description: String(o.description ?? ""),
      quantity: qty,
      unit_price: unitPrice,
      total
    };
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

export async function listInvoices(propertyId: string | number): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("invoices")
    .select(INVOICE_LIST_SELECT)
    .eq("property_id", String(propertyId))
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((r) => dbInvoiceBundleToClient(r as Record<string, unknown>));
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
  return dbInvoiceBundleToClient(data as Record<string, unknown>);
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
    invoice_date: toIsoDate(input.invoiceDate ?? input.invoice_date),
    due_date: toIsoDate(input.dueDate ?? input.due_date),
    status: String(input.status ?? "DRAFT"),
    notes: input.notes != null ? String(input.notes) : null,
    total: input.total != null ? n(input.total) : undefined,
    subtotal: input.subtotal != null ? n(input.subtotal) : undefined
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
  await requireUserId();
  const sb = getSupabase();
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
