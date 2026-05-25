import { assertSupabaseConfigured } from "../lib/supabaseClient";
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
  assertSupabaseConfigured();
  return propertiesSupabase.listProperties(params);
}

export async function getPortfolioDashboardSummary(params?: {
  propertyTypes?: string[];
  propertyId?: string | number | null;
  month?: string | null;
  portfolioIrrHorizonYears?: number | null;
  bustCache?: boolean;
}) {
  assertSupabaseConfigured();
  return dashboardSupabase.getDashboardSummary({
      propertyTypes: params?.propertyTypes,
      propertyId: params?.propertyId ?? null,
      month: params?.month ?? null,
      portfolioIrrHorizonYears: params?.portfolioIrrHorizonYears ?? null,
      bustCache: params?.bustCache
    });
}

export async function createProperty(payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return propertiesSupabase.createProperty(payload);
}

export async function getProperty(
  id: string | number,
  opts?: { bustCache?: boolean; month?: string }
) {
  assertSupabaseConfigured();
  return propertiesSupabase.getProperty(id, opts);
}

export async function updateProperty(id: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return propertiesSupabase.updateProperty(id, payload);
}

export async function deleteProperty(id: string | number) {
  assertSupabaseConfigured();
  await propertiesSupabase.deleteProperty(id);
  return { message: "Deleted" };
}

export async function getTenants() {
  assertSupabaseConfigured();
  return tenantsSupabase.listTenants();
}

export async function createTenant(payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return tenantsSupabase.createTenant(payload);
}

export async function getTenant(id: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.getTenant(id);
}

export async function updateTenant(id: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return tenantsSupabase.updateTenant(id, payload);
}

export async function deleteTenant(id: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.deleteTenant(id);
}

export async function getPropertyTenants(propertyId: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.listTenantsForProperty(propertyId);
}

export async function createPropertyTenant(propertyId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return tenantsSupabase.createTenantForProperty(propertyId, payload);
}

export async function linkTenantToProperty(propertyId: string | number, tenantId: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.linkTenantToProperty(propertyId, tenantId);
}

export async function unlinkTenantFromProperty(propertyId: string | number, tenantId: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.unlinkTenantFromProperty(propertyId, tenantId);
}

export async function getPropertyLeases(propertyId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.listLeasesForProperty(propertyId);
}

export async function getPropertyCurrentLease(propertyId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.getCurrentLease(propertyId);
}

export async function createLease(propertyId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return leasesSupabase.createLease(propertyId, payload);
}

export async function updateLease(leaseId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return leasesSupabase.updateLease(leaseId, payload);
}

export async function deleteLease(leaseId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.deleteOrArchiveLease(leaseId);
}

export async function cancelLease(leaseId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return leasesSupabase.cancelLease(leaseId, payload);
}

export async function getEquityMetrics() {
  assertSupabaseConfigured();
  const out = await equityMetricsSupabase.listEquityMetrics();
  return out.properties;
}

export async function updateEquityMetrics(
  updates: Array<{ propertyId: string | number; currentEstimatedValue: number | null; outstandingBondBalance: number | null }>
) {
  assertSupabaseConfigured();
  return equityMetricsSupabase.updateEquityMetrics(updates);
}

/** Bond → statement: amortised amounts for `dueDate` (profile as-of that date for remaining term). */
export async function previewBondStatementAtDate(propertyId: string | number, dueDate: string) {
  assertSupabaseConfigured();
  return bondOperationsVercel.previewBondAtDate(String(propertyId), dueDate) as Promise<{
    dueDate: string;
    bondFinance: Record<string, unknown>;
  }>;
}

export async function postBondStatementRow(propertyId: string | number, dueDate: string) {
  assertSupabaseConfigured();
  return bondOperationsVercel.postBondStatementRow(String(propertyId), dueDate) as Promise<{
    expense: Record<string, unknown>;
  }>;
}

export async function backfillBondStatementRows(propertyId: string | number, startDate: string, endDate: string) {
  assertSupabaseConfigured();
  return bondOperationsVercel.backfillBondStatementRows(String(propertyId), startDate, endDate) as Promise<{
      createdCount: number;
      createdIds: string[];
      skipped: Array<{ dueYmd: string; reason: string }>;
    }>;
}

export async function getPropertyFinancials(
  propertyId: string | number,
  opts?: { includeArchived?: boolean; calendarMonth?: string | null }
) {
  assertSupabaseConfigured();
  return financialsSupabase.getPropertyFinancials(propertyId, opts);
}

export async function createPropertyIncome(propertyId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return financialsSupabase.createIncome(propertyId, payload);
}

export async function markPropertyIncomeReceived(incomeId: string | number, body?: { paymentDate?: string | null }) {
  assertSupabaseConfigured();
  return financialsSupabase.markIncomeReceived(incomeId, body);
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
  assertSupabaseConfigured();
  return financialsSupabase.createExpense(propertyId, payload);
}

export async function updatePropertyExpense(expenseId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return financialsSupabase.updateExpense(expenseId, payload);
}

export async function deletePropertyExpense(expenseId: string | number) {
  assertSupabaseConfigured();
  return financialsSupabase.softDeleteExpense(expenseId);
}

export async function hardDeletePropertyExpense(expenseId: string | number) {
  assertSupabaseConfigured();
  return financialsSupabase.hardDeleteExpense(expenseId);
}

export async function deletePropertyIncome(incomeId: string | number) {
  assertSupabaseConfigured();
  return financialsSupabase.softDeleteIncome(incomeId);
}

export async function hardDeletePropertyIncome(incomeId: string | number) {
  assertSupabaseConfigured();
  return financialsSupabase.hardDeleteIncome(incomeId);
}

export async function listPropertyInvoices(propertyId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.listInvoices(propertyId);
}

export async function getInvoice(invoiceId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.getInvoice(invoiceId);
}

export async function createPropertyInvoice(propertyId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return invoicesSupabase.createInvoice(propertyId, payload);
}

export async function updateInvoice(invoiceId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return invoicesSupabase.updateInvoice(invoiceId, payload);
}

export async function markInvoicePaid(invoiceId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.markInvoicePaid(invoiceId);
}

export async function hardDeleteInvoice(invoiceId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.deleteInvoice(invoiceId);
}

/** Generate invoice PDF (Vercel + Storage when Supabase env is set). */
export async function generateInvoicePdf(invoiceId: string | number) {
  assertSupabaseConfigured();
  return generateInvoicePdfViaVercel(String(invoiceId));
}

export async function updatePropertyIncome(incomeId: string | number, payload: Record<string, unknown>) {
  assertSupabaseConfigured();
  return financialsSupabase.updateIncome(incomeId, payload);
}

export async function getPropertyStatement(
  propertyId: string | number,
  params?: { month?: string; includeExpected?: boolean; bustCache?: boolean }
) {
  assertSupabaseConfigured();
  const uuid = statementsSupabase.supabaseStatementPropertyId(propertyId);
  if (!uuid) {
    throw new Error("Property id must be a UUID to load the statement.");
  }
  return statementsSupabase.getPropertyMonthlyStatement(uuid, params);
}

export async function postPropertyFinancialBackfill(propertyId: string | number, body: Record<string, unknown>) {
  assertSupabaseConfigured();
  return operationsSupabase.runFinancialHistoricalBackfill(String(propertyId), body);
}

export async function createCurrentInvoiceFromLease(propertyId: string | number, leaseId?: string | number) {
  assertSupabaseConfigured();
  const leaseUuid =
    leaseId != null && String(leaseId).trim() !== "" && /^[0-9a-f-]{36}$/i.test(String(leaseId))
      ? String(leaseId)
      : null;
  return operationsSupabase.createInvoiceFromLease(String(propertyId), leaseUuid);
}

export async function sendInvoiceEmail(invoiceId: string | number) {
  assertSupabaseConfigured();
  return sendInvoiceEmailViaVercel(String(invoiceId));
}

export async function getPropertyWorkspaceReports(propertyId: string | number) {
  assertSupabaseConfigured();
  return propertiesSupabase.listPropertyWorkspaceReports(propertyId);
}
