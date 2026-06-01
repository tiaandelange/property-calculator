import { assertSupabaseConfigured } from "../lib/supabaseClient";
import * as propertiesSupabase from "../services/propertiesSupabase";
import * as propertyUnitsSupabase from "../services/propertyUnitsSupabase";
import * as tenantUnitLinksSupabase from "../services/tenantUnitLinksSupabase";
import * as tenantsSupabase from "../services/tenantsSupabase";
import * as leasesSupabase from "../services/leasesSupabase";
import { PAGE_SIZE as LEASE_PAGE_SIZE } from "../features/leases/leaseDirectoryUtils";
import type { LeasesDirectoryParams, PropertiesDirectoryParams, TenantsDirectoryParams } from "../lib/queryKeys";
import type { FinancialsDirectoryQueryOpts } from "../services/financialsDirectorySupabase";
import type { InvoicesDirectoryQueryOpts } from "../services/invoicesDirectorySupabase";
import * as financialsSupabase from "../services/financialsSupabase";
import * as financialsDirectorySupabase from "../services/financialsDirectorySupabase";
import * as invoicesSupabase from "../services/invoicesSupabase";
import {
  generateInvoicePdfViaVercel,
  type GenerateInvoicePdfOptions
} from "../services/invoicesVercel";
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

export async function getPropertiesDirectory(params?: PropertiesDirectoryParams) {
  assertSupabaseConfigured();
  const { getPropertiesDirectory: load } = await import("../services/propertiesDirectorySupabase");
  return load(params);
}

/** Id/name only — for filter dropdowns and property switchers. */
export async function getPropertyOptions() {
  assertSupabaseConfigured();
  return propertiesSupabase.listPropertyOptions();
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
  opts?: { bustCache?: boolean; month?: string; includeInvoices?: boolean }
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

export async function deletePropertyWorkspace(id: string | number) {
  assertSupabaseConfigured();
  await propertiesSupabase.deletePropertyWorkspace(id);
  return { message: "Deleted" };
}

export async function listPropertyUnits(propertyId: string | number) {
  assertSupabaseConfigured();
  return propertyUnitsSupabase.listPropertyUnits(String(propertyId));
}

export async function syncPropertyUnits(propertyId: string | number, units: Parameters<typeof propertyUnitsSupabase.syncPropertyUnits>[1]) {
  assertSupabaseConfigured();
  return propertyUnitsSupabase.syncPropertyUnits(String(propertyId), units);
}

export async function listTenantUnitLinks(propertyId: string | number) {
  assertSupabaseConfigured();
  return tenantUnitLinksSupabase.listTenantUnitLinksForProperty(String(propertyId));
}

export async function createTenantUnitLink(payload: tenantUnitLinksSupabase.CreateTenantUnitLinkInput) {
  assertSupabaseConfigured();
  return tenantUnitLinksSupabase.createTenantUnitLink(payload);
}

export async function updateTenantUnitLink(linkId: string, payload: tenantUnitLinksSupabase.UpdateTenantUnitLinkInput) {
  assertSupabaseConfigured();
  return tenantUnitLinksSupabase.updateTenantUnitLink(linkId, payload);
}

export async function removeTenantUnitLink(linkId: string) {
  assertSupabaseConfigured();
  return tenantUnitLinksSupabase.removeTenantUnitLink(linkId);
}

export async function getTenants() {
  assertSupabaseConfigured();
  return tenantsSupabase.listTenants();
}

export async function getTenantsDirectory(params?: TenantsDirectoryParams) {
  assertSupabaseConfigured();
  return tenantsSupabase.listTenantsDirectory(params);
}

export async function getLeasesDirectory(params?: LeasesDirectoryParams) {
  assertSupabaseConfigured();
  return leasesSupabase.listLeasesDirectoryFilteredRows({
    page: params?.page,
    pageSize: params?.pageSize ?? LEASE_PAGE_SIZE,
    q: params?.q,
    propertyId: params?.propertyId,
    status: params?.status,
    leaseType: params?.leaseType
  });
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

export async function getTenantsEligibleForProperty(propertyId: string | number) {
  assertSupabaseConfigured();
  return tenantsSupabase.listTenantsEligibleForProperty(propertyId);
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

export async function getLease(leaseId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.getLeaseById(leaseId);
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
  return leasesSupabase.hardDeleteLease(leaseId);
}

export async function archiveLease(leaseId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.deleteOrArchiveLease(leaseId);
}

export async function hardDeleteLease(leaseId: string | number) {
  assertSupabaseConfigured();
  return leasesSupabase.hardDeleteLease(leaseId);
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

export async function getFinancialsDirectory(opts?: FinancialsDirectoryQueryOpts) {
  assertSupabaseConfigured();
  return financialsDirectorySupabase.getFinancialsDirectory(opts);
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

export async function listPropertyInvoices(
  propertyId: string | number,
  filters?: Parameters<typeof invoicesSupabase.listInvoices>[1]
) {
  assertSupabaseConfigured();
  return invoicesSupabase.listInvoices(propertyId, filters);
}

export async function getInvoiceDirectoryMetrics(
  params?: import("../lib/queryKeys").InvoiceDirectoryFilterParams
) {
  assertSupabaseConfigured();
  const { getInvoiceDirectoryMetrics: load } = await import("../services/invoicesDirectorySupabase");
  return load(params);
}

export async function getInvoicesDirectoryList(params?: InvoicesDirectoryQueryOpts) {
  assertSupabaseConfigured();
  const { getInvoicesDirectoryList: load } = await import("../services/invoicesDirectorySupabase");
  return load(params);
}

/** @deprecated Use getInvoicesDirectoryList + getInvoiceDirectoryMetrics */
export async function getInvoicesDirectory(params?: InvoicesDirectoryQueryOpts) {
  assertSupabaseConfigured();
  const { getInvoicesDirectory: load } = await import("../services/invoicesDirectorySupabase");
  return load(params);
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

export async function voidInvoice(invoiceId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.voidInvoice(invoiceId);
}

/** Lock invoice for editing: draft/generated → sent with sent_at timestamp. */
export async function markInvoiceSent(invoiceId: string | number) {
  assertSupabaseConfigured();
  return invoicesSupabase.markInvoiceSent(invoiceId);
}

export async function recordInvoicePayment(
  invoiceId: string | number,
  payload: invoicesSupabase.RecordInvoicePaymentInput
) {
  assertSupabaseConfigured();
  return invoicesSupabase.recordInvoicePayment(invoiceId, payload);
}

export async function updateInvoicePayment(
  paymentId: string,
  payload: Partial<invoicesSupabase.RecordInvoicePaymentInput>
) {
  assertSupabaseConfigured();
  return invoicesSupabase.updateInvoicePayment(paymentId, payload);
}

export async function deleteInvoicePayment(paymentId: string) {
  assertSupabaseConfigured();
  return invoicesSupabase.deleteInvoicePayment(paymentId);
}

/** Generate invoice PDF (Vercel + Storage when Supabase env is set). */
export async function generateInvoicePdf(
  invoiceId: string | number,
  opts?: GenerateInvoicePdfOptions
) {
  assertSupabaseConfigured();
  return generateInvoicePdfViaVercel(String(invoiceId), opts);
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

export async function getPropertyStatementRange(
  propertyId: string | number,
  params: statementsSupabase.PropertyStatementRangeParams
) {
  assertSupabaseConfigured();
  const uuid = statementsSupabase.supabaseStatementPropertyId(propertyId);
  if (!uuid) {
    throw new Error("Property id must be a UUID to load the statement.");
  }
  return statementsSupabase.getPropertyStatementRange(uuid, params);
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

export async function sendInvoiceEmail(
  invoiceId: string | number,
  payload: Omit<import("../services/invoicesEmailVercel").SendInvoiceEmailPayload, "invoiceId">
) {
  assertSupabaseConfigured();
  return sendInvoiceEmailViaVercel({
    invoiceId: String(invoiceId),
    ...payload
  });
}

export async function getPropertyWorkspaceReports(propertyId: string | number) {
  assertSupabaseConfigured();
  return propertiesSupabase.listPropertyWorkspaceReports(propertyId);
}
