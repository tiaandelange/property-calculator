import { api, authHeader } from "./client";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import * as propertiesSupabase from "../services/propertiesSupabase";
import * as tenantsSupabase from "../services/tenantsSupabase";
import * as leasesSupabase from "../services/leasesSupabase";
import * as financialsSupabase from "../services/financialsSupabase";
import * as invoicesSupabase from "../services/invoicesSupabase";
import { generateInvoicePdfViaVercel } from "../services/invoicesVercel";
import * as dashboardSupabase from "../services/dashboardSupabase";
import * as statementsSupabase from "../services/statementsSupabase";
import * as operationsSupabase from "../services/operationsSupabase";
import * as equityMetricsSupabase from "../services/equityMetricsSupabase";
import * as bondOperationsVercel from "../services/bondOperationsVercel";
import { sendInvoiceEmailViaVercel } from "../services/invoicesEmailVercel";

/** Normalizes errors from Axios or Supabase-thrown `Error` for UI copy. */
export function propertyApiErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (e instanceof Error && e.message.trim()) return e.message;
  return "Request failed.";
}

export async function getProperties(params?: { month?: string }) {
  if (isSupabaseConfigured) {
    return propertiesSupabase.listProperties(params);
  }
  const qs = params?.month ? `?month=${encodeURIComponent(params.month)}` : "";
  const res = await api.get(`/properties${qs}`, { headers: authHeader() });
  return res.data?.properties ?? res.data;
}

export async function getPortfolioDashboardSummary(params?: {
  propertyTypes?: string[];
  propertyId?: string | number | null;
  month?: string | null;
  portfolioIrrHorizonYears?: number | null;
  bustCache?: boolean;
}) {
  if (isSupabaseConfigured) {
    return dashboardSupabase.getDashboardSummary({
      propertyTypes: params?.propertyTypes,
      propertyId: params?.propertyId ?? null,
      month: params?.month ?? null,
      portfolioIrrHorizonYears: params?.portfolioIrrHorizonYears ?? null,
      bustCache: params?.bustCache
    });
  }
  const p = new URLSearchParams();
  if (params?.propertyTypes?.length) p.set("propertyTypes", params.propertyTypes.join(","));
  if (params?.propertyId != null) p.set("propertyId", String(params.propertyId));
  if (params?.month) p.set("month", params.month);
  if (params?.portfolioIrrHorizonYears != null && Number.isFinite(params.portfolioIrrHorizonYears)) {
    p.set("portfolioIrrHorizonYears", String(Math.floor(Number(params.portfolioIrrHorizonYears))));
  }
  if (params?.bustCache === true) p.set("_", String(Date.now()));
  const qs = p.toString() ? `?${p.toString()}` : "";
  const res = await api.get(`/properties/dashboard-summary${qs}`, { headers: authHeader() });
  return res.data;
}

export async function createProperty(payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return propertiesSupabase.createProperty(payload);
  }
  const res = await api.post("/properties", payload, { headers: authHeader() });
  return res.data;
}

export async function getProperty(
  id: string | number,
  opts?: { bustCache?: boolean; month?: string }
) {
  if (isSupabaseConfigured) {
    return propertiesSupabase.getProperty(id, opts);
  }
  const params: Record<string, string | number> = {};
  if (opts?.bustCache === true) params._ = Date.now();
  if (opts?.month) params.month = opts.month;
  const res = await api.get(`/properties/${id}`, {
    headers: authHeader(),
    params: Object.keys(params).length ? params : undefined
  });
  return res.data;
}

export async function updateProperty(id: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return propertiesSupabase.updateProperty(id, payload);
  }
  const res = await api.put(`/properties/${id}`, payload, { headers: authHeader() });
  return res.data;
}

/** Deletes a property row in Supabase (Phase 5). Legacy Express DELETE remains for non-Supabase mode. */
export async function deleteProperty(id: string | number) {
  if (isSupabaseConfigured) {
    await propertiesSupabase.deleteProperty(id);
    return { message: "Deleted" };
  }
  const res = await api.delete(`/properties/${id}`, { headers: authHeader() });
  return res.data;
}

export async function getTenants() {
  if (isSupabaseConfigured) {
    return tenantsSupabase.listTenants();
  }
  const res = await api.get("/tenants", { headers: authHeader() });
  return res.data?.tenants ?? [];
}

export async function createTenant(payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.createTenant(payload);
  }
  const res = await api.post("/tenants", payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function getTenant(id: string | number) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.getTenant(id);
  }
  const res = await api.get(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function updateTenant(id: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.updateTenant(id, payload);
  }
  const res = await api.put(`/tenants/${id}`, payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function deleteTenant(id: string | number) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.deleteTenant(id);
  }
  const res = await api.delete(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function getPropertyTenants(propertyId: string | number) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.listTenantsForProperty(propertyId);
  }
  const res = await api.get(`/properties/${propertyId}/tenants`, { headers: authHeader() });
  return res.data?.tenants ?? res.data;
}

export async function createPropertyTenant(propertyId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.createTenantForProperty(propertyId, payload);
  }
  const res = await api.post(`/properties/${propertyId}/tenants`, payload, { headers: authHeader() });
  return res.data;
}

export async function linkTenantToProperty(propertyId: string | number, tenantId: string | number) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.linkTenantToProperty(propertyId, tenantId);
  }
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/link`, {}, { headers: authHeader() });
  return res.data;
}

export async function unlinkTenantFromProperty(propertyId: string | number, tenantId: string | number) {
  if (isSupabaseConfigured) {
    return tenantsSupabase.unlinkTenantFromProperty(propertyId, tenantId);
  }
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/unlink`, {}, { headers: authHeader() });
  return res.data;
}

export async function getPropertyLeases(propertyId: string | number) {
  if (isSupabaseConfigured) {
    return leasesSupabase.listLeasesForProperty(propertyId);
  }
  const res = await api.get(`/properties/${propertyId}/leases`, { headers: authHeader() });
  return res.data;
}

export async function getPropertyCurrentLease(propertyId: string | number) {
  if (isSupabaseConfigured) {
    return leasesSupabase.getCurrentLease(propertyId);
  }
  const res = await api.get(`/properties/${propertyId}/current-lease`, { headers: authHeader() });
  return res.data;
}

export async function createLease(propertyId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return leasesSupabase.createLease(propertyId, payload);
  }
  const res = await api.post(`/properties/${propertyId}/leases`, payload, { headers: authHeader() });
  return res.data;
}

export async function updateLease(leaseId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return leasesSupabase.updateLease(leaseId, payload);
  }
  const res = await api.put(`/leases/${leaseId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function deleteLease(leaseId: string | number) {
  if (isSupabaseConfigured) {
    return leasesSupabase.deleteOrArchiveLease(leaseId);
  }
  const res = await api.delete(`/leases/${leaseId}`, { headers: authHeader() });
  return res.data;
}

export async function cancelLease(leaseId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return leasesSupabase.cancelLease(leaseId, payload);
  }
  const res = await api.post(`/leases/${leaseId}/cancel`, payload, { headers: authHeader() });
  return res.data;
}

export async function getEquityMetrics() {
  if (isSupabaseConfigured) {
    const out = await equityMetricsSupabase.listEquityMetrics();
    return out.properties;
  }
  const res = await api.get("/properties/metrics/equity", { headers: authHeader() });
  return res.data?.properties ?? [];
}

export async function updateEquityMetrics(
  updates: Array<{ propertyId: string | number; currentEstimatedValue: number | null; outstandingBondBalance: number | null }>
) {
  if (isSupabaseConfigured) {
    return equityMetricsSupabase.updateEquityMetrics(updates);
  }
  const res = await api.patch("/properties/metrics/equity", { updates }, { headers: authHeader() });
  return res.data;
}

/** Bond → statement: amortised amounts for `dueDate` (profile as-of that date for remaining term). */
export async function previewBondStatementAtDate(propertyId: string | number, dueDate: string) {
  if (isSupabaseConfigured) {
    return bondOperationsVercel.previewBondAtDate(String(propertyId), dueDate) as Promise<{
      dueDate: string;
      bondFinance: Record<string, unknown>;
    }>;
  }
  const res = await api.get(`/properties/${propertyId}/bond/preview-at-date`, {
    params: { dueDate },
    headers: authHeader()
  });
  return res.data as { dueDate: string; bondFinance: Record<string, unknown> };
}

export async function postBondStatementRow(propertyId: string | number, dueDate: string) {
  if (isSupabaseConfigured) {
    return bondOperationsVercel.postBondStatementRow(String(propertyId), dueDate) as Promise<{
      expense: Record<string, unknown>;
    }>;
  }
  const res = await api.post(`/properties/${propertyId}/bond/statement-row`, { dueDate }, { headers: authHeader() });
  return res.data as { expense: Record<string, unknown> };
}

export async function backfillBondStatementRows(propertyId: string | number, startDate: string, endDate: string) {
  if (isSupabaseConfigured) {
    return bondOperationsVercel.backfillBondStatementRows(String(propertyId), startDate, endDate) as Promise<{
      createdCount: number;
      createdIds: string[];
      skipped: Array<{ dueYmd: string; reason: string }>;
    }>;
  }
  const res = await api.post(
    `/properties/${propertyId}/bond/backfill-statement-rows`,
    { startDate, endDate },
    { headers: authHeader() }
  );
  return res.data as { createdCount: number; createdIds: number[]; skipped: Array<{ dueYmd: string; reason: string }> };
}

/** Recurring templates, future-dated validation, and bond-split edits stay on Express until those domains migrate. */
function expenseCreateUsesExpress(
  payload: {
    recurringSchedule?: boolean;
    futureExpense?: boolean;
    isRecurring?: boolean;
  } & Record<string, unknown>
): boolean {
  if (payload.futureExpense === true) return true;
  return false;
}

function expensePatchUsesExpress(patch: Record<string, unknown>): boolean {
  const keys = [
    "recurringStartDate",
    "recurringEndDate",
    "recurringOpenEnded",
    "recurringMonthAnchor",
    "recurringDayOfMonth",
    "isRecurring",
    "recurringFrequency",
    "bondInterestAmount",
    "bondPrincipalAmount"
  ];
  return keys.some((k) => Object.prototype.hasOwnProperty.call(patch, k));
}

export async function getPropertyFinancials(
  propertyId: string | number,
  opts?: { includeArchived?: boolean; calendarMonth?: string | null }
) {
  if (isSupabaseConfigured) {
    return financialsSupabase.getPropertyFinancials(propertyId, opts);
  }
  const params: Record<string, string> = {};
  if (opts?.includeArchived) params.includeArchived = "true";
  const res = await api.get(`/properties/${propertyId}/financials`, {
    headers: authHeader(),
    params: Object.keys(params).length ? params : undefined
  });
  return res.data;
}

export async function createPropertyIncome(propertyId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return financialsSupabase.createIncome(propertyId, payload);
  }
  const res = await api.post(`/properties/${propertyId}/income`, payload, { headers: authHeader() });
  return res.data;
}

export async function markPropertyIncomeReceived(incomeId: string | number, body?: { paymentDate?: string | null }) {
  if (isSupabaseConfigured) {
    return financialsSupabase.markIncomeReceived(incomeId, body);
  }
  const res = await api.post(`/income/${incomeId}/mark-received`, body ?? {}, { headers: authHeader() });
  return res.data;
}

export async function createPropertyExpense(
  propertyId: string | number,
  payload: {
    category: string;
    description: string;
    amount: number;
    expenseDate?: string;
    /** One-off only: server requires expenseDate strictly after today (UTC). */
    futureExpense?: boolean;
    isRecurring?: boolean;
    recurringFrequency?: string | null;
    /** Creates a monthly schedule template; due rows are posted to the statement automatically when due. */
    recurringSchedule?: boolean;
    recurringStartDate?: string;
    recurringEndDate?: string | null;
    recurringOpenEnded?: boolean;
    recurringMonthAnchor?: "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";
    /** Required when recurringMonthAnchor is DAY_OF_MONTH (1–31). */
    recurringDayOfMonth?: number | null;
  } & Record<string, unknown>
) {
  if (isSupabaseConfigured && !expenseCreateUsesExpress(payload)) {
    return financialsSupabase.createExpense(propertyId, payload);
  }
  const res = await api.post(`/properties/${propertyId}/expenses`, payload, { headers: authHeader() });
  return res.data;
}

export async function updatePropertyExpense(expenseId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured && !expensePatchUsesExpress(payload)) {
    return financialsSupabase.updateExpense(expenseId, payload);
  }
  const res = await api.patch(`/expenses/${expenseId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyExpense(expenseId: string | number) {
  if (isSupabaseConfigured) {
    return financialsSupabase.softDeleteExpense(expenseId);
  }
  const res = await api.delete(`/expenses/${expenseId}`, { headers: authHeader() });
  return res.data;
}

export async function hardDeletePropertyExpense(expenseId: string | number) {
  if (isSupabaseConfigured) {
    return financialsSupabase.hardDeleteExpense(expenseId);
  }
  const res = await api.delete(`/expenses/${expenseId}/hard`, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyIncome(incomeId: string | number) {
  if (isSupabaseConfigured) {
    return financialsSupabase.softDeleteIncome(incomeId);
  }
  const res = await api.delete(`/income/${incomeId}`, { headers: authHeader() });
  return res.data;
}

export async function hardDeletePropertyIncome(incomeId: string | number) {
  if (isSupabaseConfigured) {
    return financialsSupabase.hardDeleteIncome(incomeId);
  }
  const res = await api.delete(`/income/${incomeId}/hard`, { headers: authHeader() });
  return res.data;
}

export async function listPropertyInvoices(propertyId: string | number) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.listInvoices(propertyId);
  }
  const res = await api.get(`/properties/${propertyId}/invoices`, { headers: authHeader() });
  return res.data;
}

export async function getInvoice(invoiceId: string | number) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.getInvoice(invoiceId);
  }
  const res = await api.get(`/invoices/${invoiceId}`, { headers: authHeader() });
  return res.data;
}

export async function createPropertyInvoice(propertyId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.createInvoice(propertyId, payload);
  }
  const res = await api.post(`/properties/${propertyId}/invoices`, payload, { headers: authHeader() });
  return res.data;
}

export async function updateInvoice(invoiceId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.updateInvoice(invoiceId, payload);
  }
  const res = await api.put(`/invoices/${invoiceId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function markInvoicePaid(invoiceId: string | number) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.markInvoicePaid(invoiceId);
  }
  const res = await api.post(`/invoices/${invoiceId}/mark-paid`, {}, { headers: authHeader() });
  return res.data;
}

export async function hardDeleteInvoice(invoiceId: string | number) {
  if (isSupabaseConfigured) {
    return invoicesSupabase.deleteInvoice(invoiceId);
  }
  const res = await api.delete(`/invoices/${invoiceId}/hard`, { headers: authHeader() });
  return res.data;
}

/** Generate invoice PDF (Vercel + Storage when Supabase env is set). */
export async function generateInvoicePdf(invoiceId: string | number) {
  if (isSupabaseConfigured) {
    return generateInvoicePdfViaVercel(String(invoiceId));
  }
  const res = await api.post(`/invoices/${invoiceId}/generate-pdf`, {}, { headers: authHeader() });
  return res.data;
}

export async function updatePropertyIncome(incomeId: string | number, payload: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return financialsSupabase.updateIncome(incomeId, payload);
  }
  const res = await api.put(`/income/${incomeId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function getPropertyStatement(
  propertyId: string | number,
  params?: { month?: string; includeExpected?: boolean; bustCache?: boolean }
) {
  if (isSupabaseConfigured) {
    const uuid = statementsSupabase.supabaseStatementPropertyId(propertyId);
    if (!uuid) {
      throw new Error("Property id must be a UUID to load the statement when Supabase is configured.");
    }
    return statementsSupabase.getPropertyMonthlyStatement(uuid, params);
  }
  const p = new URLSearchParams();
  if (params?.month) p.set("month", params.month);
  if (params?.includeExpected === false) p.set("includeExpected", "false");
  if (params?.bustCache === true) p.set("_", String(Date.now()));
  const qs = p.toString() ? `?${p}` : "";
  const res = await api.get(`/properties/${propertyId}/statement${qs}`, { headers: authHeader() });
  return res.data;
}

export async function postPropertyFinancialBackfill(propertyId: string | number, body: Record<string, unknown>) {
  if (isSupabaseConfigured) {
    return operationsSupabase.runFinancialHistoricalBackfill(String(propertyId), body);
  }
  const res = await api.post(`/properties/${propertyId}/financials/backfill`, body, { headers: authHeader() });
  return res.data;
}

export async function createCurrentInvoiceFromLease(propertyId: string | number, leaseId?: string | number) {
  if (isSupabaseConfigured) {
    const leaseUuid =
      leaseId != null && String(leaseId).trim() !== "" && /^[0-9a-f-]{36}$/i.test(String(leaseId))
        ? String(leaseId)
        : null;
    return operationsSupabase.createInvoiceFromLease(String(propertyId), leaseUuid);
  }
  const body = leaseId != null && String(leaseId).trim() !== "" ? { leaseId } : {};
  const res = await api.post(`/properties/${propertyId}/invoices/create-current`, body, { headers: authHeader() });
  return res.data;
}

export async function sendInvoiceEmail(invoiceId: string | number) {
  if (isSupabaseConfigured) {
    return sendInvoiceEmailViaVercel(String(invoiceId));
  }
  const res = await api.post(`/invoices/${invoiceId}/send-email`, {}, { headers: authHeader() });
  return res.data;
}

export async function getPropertyWorkspaceReports(propertyId: string | number) {
  const res = await api.get(`/properties/${propertyId}/reports`, { headers: authHeader() });
  return res.data;
}
