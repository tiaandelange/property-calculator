export type PropertiesListFilters = { month?: string | null };

export type DashboardSummaryParams = {
  propertyTypes?: string[];
  month?: string | null;
  propertyId?: string | number | null;
  portfolioIrrHorizonYears?: number | null;
};

export type FinancialsDirectoryParams = {
  month: string;
  propertyId: string | null;
  page?: number;
  pageSize?: number;
  q?: string;
  source?: string;
};

export type DirectoryPaginationParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  propertyId?: string | null;
};

export type PropertiesDirectoryParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: string;
  status?: string;
  sort?: string;
};

export type LeasesDirectoryParams = DirectoryPaginationParams & {
  status?: string;
  leaseType?: string;
};

export type TenantsDirectorySortParams = {
  leaseStatus?: string;
  paymentStatus?: string;
  tab?: "tenants" | "applicants";
};

export type InvoicesDirectoryParams = DirectoryPaginationParams & {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

/** Invoice directory filters without pagination (metrics cache key). */
export type InvoiceDirectoryFilterParams = {
  q?: string;
  propertyId?: string | null;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type TenantsDirectoryParams = DirectoryPaginationParams & TenantsDirectorySortParams;

export type PropertyStatementParams = {
  month: string;
  includeExpected?: boolean;
};

export type PropertyStatementRangeParams = {
  startDate: string;
  endDate: string;
  includeExpected?: boolean;
};

function sortedTypesKey(types?: string[]): string {
  if (!types?.length) return "all";
  return [...types].sort().join(",");
}

function normalizeDashboardParams(params: DashboardSummaryParams) {
  return {
    month: params.month?.trim() || null,
    propertyId: params.propertyId != null && String(params.propertyId).trim() !== "" ? String(params.propertyId) : null,
    types: sortedTypesKey(params.propertyTypes),
    irr: params.portfolioIrrHorizonYears ?? null
  };
}

/** Stable TanStack Query keys scoped by workspace (signed-in user id). */
export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  subscription: (workspaceId: string) => ["subscription", workspaceId] as const,
  settings: (workspaceId: string) => ["settings", workspaceId] as const,
  properties: (workspaceId: string, filters: PropertiesListFilters = {}) =>
    ["properties", workspaceId, filters.month ?? "current"] as const,
  propertyOptions: (workspaceId: string) => ["properties", workspaceId, "options"] as const,
  property: (propertyId: string, variant: "core" | "full" = "full") => ["property", propertyId, variant] as const,
  propertyTenants: (propertyId: string) => ["property", propertyId, "tenants"] as const,
  propertyInvoices: (propertyId: string) => ["property", propertyId, "invoices"] as const,
  propertyReports: (propertyId: string) => ["property", propertyId, "reports"] as const,
  propertyUnits: (propertyId: string) => ["property-units", propertyId] as const,
  leases: (workspaceId: string, filters: Record<string, unknown> = {}) =>
    ["leases", workspaceId, filters] as const,
  propertyLeases: (propertyId: string) => ["leases", "property", propertyId] as const,
  tenants: (workspaceId: string, filters: Record<string, unknown> = {}) =>
    ["tenants", workspaceId, filters] as const,
  propertiesDirectory: (workspaceId: string, params: PropertiesDirectoryParams = {}) =>
    [
      "properties-directory",
      workspaceId,
      params.page ?? 1,
      params.pageSize ?? 25,
      params.q ?? "",
      params.type ?? "ALL",
      params.status ?? "ALL",
      params.sort ?? "RECENT"
    ] as const,
  tenantsDirectory: (workspaceId: string, params: TenantsDirectoryParams = {}) =>
    [
      "tenants-directory",
      workspaceId,
      params.page ?? 1,
      params.pageSize ?? 6,
      params.q ?? "",
      params.propertyId ?? "ALL",
      params.leaseStatus ?? "ALL",
      params.paymentStatus ?? "ALL",
      params.tab ?? "tenants"
    ] as const,
  leasesDirectory: (workspaceId: string, params: LeasesDirectoryParams = {}) =>
    [
      "leases-directory",
      workspaceId,
      params.page ?? 1,
      params.pageSize ?? 6,
      params.q ?? "",
      params.propertyId ?? "ALL",
      params.status ?? "ALL",
      params.leaseType ?? "ALL"
    ] as const,
  invoices: (workspaceId: string, filters: Record<string, unknown> = {}) =>
    ["invoices", workspaceId, filters] as const,
  invoiceMetrics: (workspaceId: string, filters: InvoiceDirectoryFilterParams = {}) =>
    [
      "invoice-metrics",
      workspaceId,
      filters.q ?? "",
      filters.propertyId ?? "ALL",
      filters.status ?? "ALL",
      filters.dateFrom ?? "",
      filters.dateTo ?? ""
    ] as const,
  invoicesList: (workspaceId: string, params: InvoicesDirectoryParams = {}) =>
    [
      "invoices",
      workspaceId,
      params.page ?? 1,
      params.pageSize ?? 20,
      params.q ?? "",
      params.propertyId ?? "ALL",
      params.status ?? "ALL",
      params.dateFrom ?? "",
      params.dateTo ?? ""
    ] as const,
  /** @deprecated Prefer invoiceMetrics + invoicesList */
  invoicesDirectory: (workspaceId: string, params: InvoicesDirectoryParams = {}) =>
    ["invoices", workspaceId, "directory", params] as const,
  financialsDirectory: (workspaceId: string, params: FinancialsDirectoryParams) =>
    [
      "financials",
      workspaceId,
      params.month,
      params.propertyId ?? "ALL",
      params.page ?? 1,
      params.pageSize ?? 25,
      params.q ?? "",
      params.source ?? "ALL"
    ] as const,
  propertyStatement: (propertyId: string, params: PropertyStatementParams) =>
    ["property-statement", propertyId, params.month, params.includeExpected !== false] as const,
  propertyStatementRange: (propertyId: string, params: PropertyStatementRangeParams) =>
    [
      "property-statement-range",
      propertyId,
      params.startDate,
      params.endDate,
      params.includeExpected !== false
    ] as const,
  propertyAdditionalBonds: (propertyId: string) => ["property-additional-bonds", propertyId] as const,
  tenantStatement: (tenantId: string, periodKey: string) => ["tenant-statement", tenantId, periodKey] as const,
  workspaceSearch: (workspaceId: string, q: string) => ["workspace-search", workspaceId, q.trim().toLowerCase()] as const,
  workspaceNotifications: (workspaceId: string) => ["workspace-notifications", workspaceId] as const,
  dashboardSummary: (workspaceId: string, params: DashboardSummaryParams) =>
    ["dashboard-summary", workspaceId, normalizeDashboardParams(params)] as const,
  reports: (workspaceId: string) => ["reports", workspaceId] as const,
  tenant: (tenantId: string) => ["tenant", tenantId] as const,
  invoiceDetail: (invoiceId: string) => ["invoice", invoiceId] as const
};
