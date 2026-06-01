import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  dbInvoiceBundleToClient,
  dbInvoiceToClient,
  rpcInvoiceCreateResultToClient
} from "../api/invoiceRowMapping";
import { isInvoiceEditable } from "../features/invoices/invoiceFoundation";

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

/** Property/tenant workspace lists — summary columns only (no line items). */
const INVOICE_PROPERTY_LIST_SELECT = `
  id,
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
  pdf_storage_bucket
`;

const INVOICE_DETAIL_SELECT = `
  *,
  invoice_line_items (*),
  invoice_payments (*),
  tenants ( id, first_name, last_name, email, phone ),
  properties ( id, name ),
  property_units ( id, unit_name ),
  leases ( id, start_date, fixed_term_end_date, status, lease_reference )
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
  property_units ( id, unit_name ),
  leases ( id, start_date, fixed_term_end_date, status, lease_reference )
`;

export type InvoicesDirectoryListFilters = {
  propertyId?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

export async function listInvoicesDirectory(
  filters?: InvoicesDirectoryListFilters
): Promise<{ rows: Record<string, unknown>[]; totalCount: number; metricsRows?: Record<string, unknown>[] }> {
  const uid = await requireUserId();
  const sb = getSupabase();

  let metricsQuery = sb.from("invoices").select(
    "id, property_id, tenant_id, lease_id, invoice_number, status, due_date, total, total_amount, balance_due, paid_at, invoice_date"
  ).eq("user_id", uid);
  if (filters?.propertyId) metricsQuery = metricsQuery.eq("property_id", filters.propertyId);
  if (filters?.status) metricsQuery = metricsQuery.eq("status", String(filters.status).toUpperCase());
  if (filters?.dateFrom) metricsQuery = metricsQuery.gte("due_date", filters.dateFrom);
  if (filters?.dateTo) metricsQuery = metricsQuery.lte("due_date", filters.dateTo);

  let pageQuery = sb.from("invoices").select(INVOICE_DIRECTORY_SELECT, { count: "exact" }).eq("user_id", uid);
  if (filters?.propertyId) pageQuery = pageQuery.eq("property_id", filters.propertyId);
  if (filters?.status) pageQuery = pageQuery.eq("status", String(filters.status).toUpperCase());
  if (filters?.dateFrom) pageQuery = pageQuery.gte("due_date", filters.dateFrom);
  if (filters?.dateTo) pageQuery = pageQuery.lte("due_date", filters.dateTo);
  pageQuery = pageQuery
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.limit != null && filters.offset != null) {
    pageQuery = pageQuery.range(filters.offset, filters.offset + filters.limit - 1);
  }

  const [metricsRes, pageRes] = await Promise.all([metricsQuery, pageQuery]);
  if (metricsRes.error) throw toError(metricsRes.error);
  if (pageRes.error) throw toError(pageRes.error);

  let metricsRows = (metricsRes.data ?? []) as Record<string, unknown>[];
  let rows = (pageRes.data ?? []) as Record<string, unknown>[];

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    const match = (row: Record<string, unknown>) => {
      const tenant = row.tenants as Record<string, unknown> | null;
      const property = row.properties as Record<string, unknown> | null;
      const hay = `${row.invoice_number ?? ""} ${tenant?.first_name ?? ""} ${tenant?.last_name ?? ""} ${property?.name ?? ""} ${row.status ?? ""}`.toLowerCase();
      return hay.includes(q);
    };
    metricsRows = metricsRows.filter(match);
    rows = rows.filter(match);
  }

  const totalCount = q ? metricsRows.length : (pageRes.count ?? rows.length);

  if (q && filters?.limit != null && filters.offset != null) {
    rows = metricsRows.slice(filters.offset, filters.offset + filters.limit);
  }

  return { rows, totalCount, metricsRows: q ? metricsRows : undefined };
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
    /** When false, skips Storage signed-URL generation (faster list views). Default true. */
    attachDownloadUrls?: boolean;
    /** When false, omits line items from the select (faster list views). Default true. */
    includeLineItems?: boolean;
  }
): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  const selectCols = filters?.includeLineItems === false ? INVOICE_PROPERTY_LIST_SELECT : INVOICE_LIST_SELECT;
  let query = sb
    .from("invoices")
    .select(selectCols)
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
  const mapped = (data ?? []).map((r) =>
    dbInvoiceBundleToClient(r as unknown as Record<string, unknown>)
  );
  if (filters?.attachDownloadUrls === false) return mapped;
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

export async function markInvoiceSent(id: string | number): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data: existing, error: fetchErr } = await sb
    .from("invoices")
    .select("id, status")
    .eq("id", String(id))
    .eq("user_id", uid)
    .maybeSingle();
  if (fetchErr) throw toError(fetchErr);
  if (!existing) throw new Error("Invoice not found");
  if (!isInvoiceEditable(existing.status)) {
    throw new Error("Invoice cannot be marked as sent in its current status.");
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("invoices")
    .update({
      status: "SENT",
      sent_at: now,
      updated_at: now
    })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbInvoiceToClient(data as Record<string, unknown>);
}

export async function markInvoicePaid(id: string | number): Promise<Record<string, unknown>> {
  const inv = await getInvoice(id);
  const total = n(inv.totalAmount ?? inv.total);
  const balance = inv.balanceDue != null ? n(inv.balanceDue) : total;
  const amount = balance > 0 ? balance : total;
  return recordInvoicePayment(id, {
    paymentDate: new Date().toISOString().slice(0, 10),
    amount
  });
}

export type RecordInvoicePaymentInput = {
  paymentDate: string;
  paymentReference?: string | null;
  amount: number;
};

export async function recordInvoicePayment(
  invoiceId: string | number,
  input: RecordInvoicePaymentInput
): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("record_invoice_payment", {
    p_invoice_id: String(invoiceId),
    p_payment_date: input.paymentDate.slice(0, 10),
    p_payment_reference: input.paymentReference?.trim() || null,
    p_amount: input.amount
  });
  if (error) throw toError(error);
  return rpcInvoiceCreateResultToClient(data as Record<string, unknown>);
}

export async function updateInvoicePayment(
  paymentId: string,
  input: Partial<RecordInvoicePaymentInput>
): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const payload: Record<string, unknown> = { p_payment_id: paymentId };
  if (input.paymentDate != null) payload.p_payment_date = input.paymentDate.slice(0, 10);
  if (input.paymentReference !== undefined) {
    payload.p_payment_reference = input.paymentReference?.trim() || null;
  }
  if (input.amount != null) payload.p_amount = input.amount;
  const { data, error } = await sb.rpc("update_invoice_payment", payload);
  if (error) throw toError(error);
  return rpcInvoiceCreateResultToClient(data as Record<string, unknown>);
}

export async function deleteInvoicePayment(paymentId: string): Promise<Record<string, unknown>> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("delete_invoice_payment", { p_payment_id: paymentId });
  if (error) throw toError(error);
  return rpcInvoiceCreateResultToClient(data as Record<string, unknown>);
}
