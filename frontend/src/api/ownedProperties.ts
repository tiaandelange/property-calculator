import { api, authHeader } from "./client";

export async function getProperties(params?: { month?: string }) {
  const qs = params?.month ? `?month=${encodeURIComponent(params.month)}` : "";
  const res = await api.get(`/properties${qs}`, { headers: authHeader() });
  return res.data?.properties ?? res.data;
}

export async function getPortfolioDashboardSummary(params?: {
  propertyTypes?: string[];
  propertyId?: number | null;
  month?: string | null;
  bustCache?: boolean;
}) {
  const p = new URLSearchParams();
  if (params?.propertyTypes?.length) p.set("propertyTypes", params.propertyTypes.join(","));
  if (params?.propertyId != null) p.set("propertyId", String(params.propertyId));
  if (params?.month) p.set("month", params.month);
  if (params?.bustCache === true) p.set("_", String(Date.now()));
  const qs = p.toString() ? `?${p.toString()}` : "";
  const res = await api.get(`/properties/dashboard-summary${qs}`, { headers: authHeader() });
  return res.data;
}

export async function createProperty(payload: Record<string, unknown>) {
  const res = await api.post("/properties", payload, { headers: authHeader() });
  return res.data;
}

export async function getProperty(
  id: string | number,
  opts?: { bustCache?: boolean; month?: string }
) {
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
  const res = await api.put(`/properties/${id}`, payload, { headers: authHeader() });
  return res.data;
}

export async function getTenants() {
  const res = await api.get("/tenants", { headers: authHeader() });
  return res.data?.tenants ?? [];
}

export async function createTenant(payload: Record<string, unknown>) {
  const res = await api.post("/tenants", payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function getTenant(id: string | number) {
  const res = await api.get(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function updateTenant(id: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/tenants/${id}`, payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function deleteTenant(id: string | number) {
  const res = await api.delete(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function getPropertyTenants(propertyId: string | number) {
  const res = await api.get(`/properties/${propertyId}/tenants`, { headers: authHeader() });
  return res.data?.tenants ?? res.data;
}

export async function createPropertyTenant(propertyId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/properties/${propertyId}/tenants`, payload, { headers: authHeader() });
  return res.data;
}

export async function linkTenantToProperty(propertyId: string | number, tenantId: string | number) {
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/link`, {}, { headers: authHeader() });
  return res.data;
}

export async function unlinkTenantFromProperty(propertyId: string | number, tenantId: string | number) {
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/unlink`, {}, { headers: authHeader() });
  return res.data;
}

export async function createLease(propertyId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/properties/${propertyId}/leases`, payload, { headers: authHeader() });
  return res.data;
}

export async function updateLease(leaseId: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/leases/${leaseId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function deleteLease(leaseId: string | number) {
  const res = await api.delete(`/leases/${leaseId}`, { headers: authHeader() });
  return res.data;
}

export async function cancelLease(leaseId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/leases/${leaseId}/cancel`, payload, { headers: authHeader() });
  return res.data;
}

export async function getEquityMetrics() {
  const res = await api.get("/properties/metrics/equity", { headers: authHeader() });
  return res.data?.properties ?? [];
}

export async function updateEquityMetrics(updates: Array<{ propertyId: number; currentEstimatedValue: number | null; outstandingBondBalance: number | null }>) {
  const res = await api.patch("/properties/metrics/equity", { updates }, { headers: authHeader() });
  return res.data;
}

/** Bond → statement: amortised amounts for `dueDate` (profile as-of that date for remaining term). */
export async function previewBondStatementAtDate(propertyId: string | number, dueDate: string) {
  const res = await api.get(`/properties/${propertyId}/bond/preview-at-date`, {
    params: { dueDate },
    headers: authHeader()
  });
  return res.data as { dueDate: string; bondFinance: Record<string, unknown> };
}

export async function postBondStatementRow(propertyId: string | number, dueDate: string) {
  const res = await api.post(`/properties/${propertyId}/bond/statement-row`, { dueDate }, { headers: authHeader() });
  return res.data as { expense: Record<string, unknown> };
}

export async function backfillBondStatementRows(propertyId: string | number, startDate: string, endDate: string) {
  const res = await api.post(
    `/properties/${propertyId}/bond/backfill-statement-rows`,
    { startDate, endDate },
    { headers: authHeader() }
  );
  return res.data as { createdCount: number; createdIds: number[]; skipped: Array<{ dueYmd: string; reason: string }> };
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
  }
) {
  const res = await api.post(`/properties/${propertyId}/expenses`, payload, { headers: authHeader() });
  return res.data;
}

export async function updatePropertyExpense(expenseId: string | number, payload: Record<string, unknown>) {
  const res = await api.patch(`/expenses/${expenseId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyExpense(expenseId: string | number) {
  const res = await api.delete(`/expenses/${expenseId}`, { headers: authHeader() });
  return res.data;
}

export async function hardDeletePropertyExpense(expenseId: string | number) {
  const res = await api.delete(`/expenses/${expenseId}/hard`, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyIncome(incomeId: string | number) {
  const res = await api.delete(`/income/${incomeId}`, { headers: authHeader() });
  return res.data;
}

export async function hardDeletePropertyIncome(incomeId: string | number) {
  const res = await api.delete(`/income/${incomeId}/hard`, { headers: authHeader() });
  return res.data;
}

export async function hardDeleteInvoice(invoiceId: string | number) {
  const res = await api.delete(`/invoices/${invoiceId}/hard`, { headers: authHeader() });
  return res.data;
}

export async function updatePropertyIncome(incomeId: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/income/${incomeId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function getPropertyStatement(
  propertyId: string | number,
  params?: { month?: string; includeExpected?: boolean; bustCache?: boolean }
) {
  const p = new URLSearchParams();
  if (params?.month) p.set("month", params.month);
  if (params?.includeExpected === false) p.set("includeExpected", "false");
  if (params?.bustCache === true) p.set("_", String(Date.now()));
  const qs = p.toString() ? `?${p}` : "";
  const res = await api.get(`/properties/${propertyId}/statement${qs}`, { headers: authHeader() });
  return res.data;
}

export async function postPropertyFinancialBackfill(propertyId: string | number, body: Record<string, unknown>) {
  const res = await api.post(`/properties/${propertyId}/financials/backfill`, body, { headers: authHeader() });
  return res.data;
}

export async function createCurrentInvoiceFromLease(propertyId: string | number, leaseId?: number) {
  const body = leaseId != null && Number.isFinite(leaseId) ? { leaseId } : {};
  const res = await api.post(`/properties/${propertyId}/invoices/create-current`, body, { headers: authHeader() });
  return res.data;
}

export async function getPropertyWorkspaceReports(propertyId: string | number) {
  const res = await api.get(`/properties/${propertyId}/reports`, { headers: authHeader() });
  return res.data;
}
