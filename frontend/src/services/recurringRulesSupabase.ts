import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabaseClient";
import {
  dbToExpense,
  recurringIncomeRuleToCamel,
  recurringInvoiceRuleToCamel
} from "../api/financialRowMapping";

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

function ymdToUtcNoonIso(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(ymd).toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
}

function coerceExpenseYmd(v: unknown): string {
  if (v == null) return new Date().toISOString().slice(0, 10);
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return new Date(t).toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return new Date(String(v)).toISOString().slice(0, 10);
}

function coerceNextRunIso(v: unknown): string {
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

export type RecurringIncomeListFilter =
  | { propertyId: string | number }
  | { leaseId: string | number };

/** Recurring rent / lease income rules (one row per lease in DB). */
export async function listRecurringIncomeRules(
  filter: RecurringIncomeListFilter
): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  let q = sb.from("recurring_income_rules").select("*");
  if ("leaseId" in filter) {
    q = q.eq("lease_id", String(filter.leaseId));
  } else {
    q = q.eq("property_id", String(filter.propertyId));
  }
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((r) => recurringIncomeRuleToCamel(r as Record<string, unknown>));
}

export async function activateRecurringIncomeRule(id: string | number): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("recurring_income_rules")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return recurringIncomeRuleToCamel(data as Record<string, unknown>);
}

export async function pauseRecurringIncomeRule(id: string | number): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("recurring_income_rules")
    .update({ status: "PAUSED", updated_at: new Date().toISOString() })
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return recurringIncomeRuleToCamel(data as Record<string, unknown>);
}

export async function listRecurringInvoiceRules(propertyId: string | number): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("recurring_invoice_rules")
    .select("*")
    .eq("property_id", String(propertyId))
    .order("created_at", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((r) => recurringInvoiceRuleToCamel(r as Record<string, unknown>));
}

export async function createRecurringInvoiceRule(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const tenantId = input.tenantId ?? input.tenant_id;
  if (tenantId == null || tenantId === "") throw new Error("tenantId is required.");

  const row: Record<string, unknown> = {
    user_id: uid,
    property_id: String(propertyId),
    tenant_id: String(tenantId),
    lease_id: input.leaseId != null && input.leaseId !== "" ? String(input.leaseId) : null,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : false,
    frequency: String(input.frequency ?? "MONTHLY"),
    day_of_month: input.dayOfMonth != null ? n(input.dayOfMonth) : 1,
    next_run_date: coerceNextRunIso(input.nextRunDate ?? input.next_run_date),
    invoice_description: String(input.invoiceDescription ?? input.invoice_description ?? "Monthly Rent"),
    rent_amount: n(input.rentAmount ?? input.rent_amount),
    include_utilities: Boolean(input.includeUtilities ?? input.include_utilities ?? false),
    email_tenant: Boolean(input.emailTenant ?? input.email_tenant ?? false),
    tenant_permission_confirmed: Boolean(
      input.tenantPermissionConfirmed ?? input.tenant_permission_confirmed ?? false
    )
  };

  const { data, error } = await sb.from("recurring_invoice_rules").insert(row).select("*").single();
  if (error) throw toError(error);
  return recurringInvoiceRuleToCamel(data as Record<string, unknown>);
}

export async function updateRecurringInvoiceRule(
  id: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.enabled !== undefined) patch.enabled = Boolean(input.enabled);
  if (input.dayOfMonth !== undefined || input.day_of_month !== undefined) {
    patch.day_of_month = n(input.dayOfMonth ?? input.day_of_month);
  }
  if (input.nextRunDate !== undefined || input.next_run_date !== undefined) {
    patch.next_run_date = coerceNextRunIso(input.nextRunDate ?? input.next_run_date);
  }
  if (input.invoiceDescription !== undefined || input.invoice_description !== undefined) {
    patch.invoice_description = String(input.invoiceDescription ?? input.invoice_description ?? "");
  }
  if (input.rentAmount !== undefined || input.rent_amount !== undefined) {
    patch.rent_amount = n(input.rentAmount ?? input.rent_amount);
  }
  if (input.includeUtilities !== undefined || input.include_utilities !== undefined) {
    patch.include_utilities = Boolean(input.includeUtilities ?? input.include_utilities);
  }
  if (input.emailTenant !== undefined || input.email_tenant !== undefined) {
    patch.email_tenant = Boolean(input.emailTenant ?? input.email_tenant);
  }
  if (input.tenantPermissionConfirmed !== undefined || input.tenant_permission_confirmed !== undefined) {
    patch.tenant_permission_confirmed = Boolean(
      input.tenantPermissionConfirmed ?? input.tenant_permission_confirmed
    );
  }
  if (input.leaseId !== undefined || input.lease_id !== undefined) {
    const lid = input.leaseId ?? input.lease_id;
    patch.lease_id = lid != null && lid !== "" ? String(lid) : null;
  }
  if (input.frequency !== undefined) patch.frequency = String(input.frequency);
  if (input.tenantId !== undefined || input.tenant_id !== undefined) {
    const tid = input.tenantId ?? input.tenant_id;
    if (tid != null && tid !== "") patch.tenant_id = String(tid);
  }

  const { data, error } = await sb
    .from("recurring_invoice_rules")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw toError(error);
  return recurringInvoiceRuleToCamel(data as Record<string, unknown>);
}

export async function deleteRecurringInvoiceRule(id: string | number): Promise<void> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const { error } = await sb.from("recurring_invoice_rules").delete().eq("id", String(id)).eq("user_id", uid);
  if (error) throw toError(error);
}

/** Recurring expense templates: parent row with `is_recurring` and no `recurring_schedule_parent_id`. */
export async function listRecurringExpenseTemplates(propertyId: string | number): Promise<Record<string, unknown>[]> {
  await requireUserId();
  const sb = getSupabase();
  const { data, error } = await sb
    .from("expense_entries")
    .select("*")
    .eq("property_id", String(propertyId))
    .eq("is_recurring", true)
    .is("recurring_schedule_parent_id", null)
    .neq("status", "ARCHIVED")
    .order("expense_date", { ascending: false });
  if (error) throw toError(error);
  return (data ?? []).map((r) => dbToExpense(r as Record<string, unknown>));
}

export async function createRecurringExpenseTemplate(
  propertyId: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const ymd = coerceExpenseYmd(input.expenseDate ?? input.expense_date);
  const startYmd = coerceExpenseYmd(input.recurringStartDate ?? input.recurring_start_date ?? ymd);
  const endRaw = input.recurringEndDate ?? input.recurring_end_date;
  const openEnded = input.recurringOpenEnded ?? input.recurring_open_ended;
  const openEndedBool = openEnded !== undefined ? Boolean(openEnded) : true;
  const endYmd =
    openEndedBool || endRaw == null || endRaw === ""
      ? null
      : coerceExpenseYmd(endRaw);
  const anchor = String(input.recurringMonthAnchor ?? input.recurring_month_anchor ?? "FIRST_OF_MONTH");
  const dom =
    anchor === "DAY_OF_MONTH"
      ? n(input.recurringDayOfMonth ?? input.recurring_day_of_month ?? 1)
      : null;

  const row: Record<string, unknown> = {
    user_id: uid,
    property_id: String(propertyId),
    category: String(input.category ?? "OTHER"),
    description: String(input.description ?? "Recurring expense"),
    amount: n(input.amount),
    expense_date: ymdToUtcNoonIso(ymd),
    is_recurring: true,
    recurring_frequency: String(input.recurringFrequency ?? input.recurring_frequency ?? "MONTHLY"),
    recurring_schedule_parent_id: null,
    recurring_start_date: startYmd,
    recurring_end_date: endYmd,
    recurring_open_ended: openEndedBool,
    recurring_month_anchor: anchor,
    recurring_day_of_month: dom,
    source: String(input.source ?? "MANUAL_FINANCIAL_ENTRY"),
    status: String(input.status ?? "ACTIVE")
  };

  const { data, error } = await sb.from("expense_entries").insert(row).select("*").single();
  if (error) throw toError(error);
  return dbToExpense(data as Record<string, unknown>);
}

export async function updateRecurringExpenseTemplate(
  id: string | number,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uid = await requireUserId();
  const sb = getSupabase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.category != null) patch.category = String(input.category);
  if (input.description !== undefined) patch.description = String(input.description ?? "");
  if (input.amount !== undefined) patch.amount = n(input.amount);
  if (input.expenseDate != null || input.expense_date != null) {
    const ymd = coerceExpenseYmd(input.expenseDate ?? input.expense_date);
    patch.expense_date = ymdToUtcNoonIso(ymd);
  }
  if (input.recurringFrequency !== undefined || input.recurring_frequency !== undefined) {
    patch.recurring_frequency = String(input.recurringFrequency ?? input.recurring_frequency);
  }
  if (input.recurringStartDate !== undefined || input.recurring_start_date !== undefined) {
    const rs = input.recurringStartDate ?? input.recurring_start_date;
    patch.recurring_start_date = rs == null || rs === "" ? null : coerceExpenseYmd(rs);
  }
  if (input.recurringEndDate !== undefined || input.recurring_end_date !== undefined) {
    const re = input.recurringEndDate ?? input.recurring_end_date;
    patch.recurring_end_date = re == null || re === "" ? null : coerceExpenseYmd(re);
  }
  if (input.recurringOpenEnded !== undefined || input.recurring_open_ended !== undefined) {
    patch.recurring_open_ended = Boolean(input.recurringOpenEnded ?? input.recurring_open_ended);
  }
  if (input.recurringMonthAnchor !== undefined || input.recurring_month_anchor !== undefined) {
    patch.recurring_month_anchor = String(input.recurringMonthAnchor ?? input.recurring_month_anchor);
  }
  if (input.recurringDayOfMonth !== undefined || input.recurring_day_of_month !== undefined) {
    patch.recurring_day_of_month = n(input.recurringDayOfMonth ?? input.recurring_day_of_month);
  }
  if (input.status != null) patch.status = String(input.status);

  const { data, error } = await sb
    .from("expense_entries")
    .update(patch)
    .eq("id", String(id))
    .eq("user_id", uid)
    .eq("is_recurring", true)
    .is("recurring_schedule_parent_id", null)
    .select("*")
    .single();
  if (error) throw toError(error);
  return dbToExpense(data as Record<string, unknown>);
}

/** Same as `listRecurringIncomeRules({ propertyId })` — kept for `financialsSupabase` re-export compatibility. */
export async function listRecurringIncomeRulesForProperty(
  propertyId: string | number
): Promise<Record<string, unknown>[]> {
  return listRecurringIncomeRules({ propertyId });
}
