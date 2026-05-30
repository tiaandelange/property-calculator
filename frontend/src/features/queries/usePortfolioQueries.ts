import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFinancialsDirectory,
  getInvoicesDirectoryList,
  getInvoiceDirectoryMetrics,
  getLeasesDirectory,
  getPortfolioDashboardSummary,
  getProperties,
  getPropertiesDirectory,
  getProperty,
  getPropertyOptions,
  getTenants,
  getTenantsDirectory
} from "../../api/ownedProperties";
import { getOrCreateUserSettings } from "../../services/settingsSupabase";
import {
  GC_TIME_MS,
  STALE_TIME_DASHBOARD_MS,
  STALE_TIME_DIRECTORY_MS,
  STALE_TIME_METADATA_MS,
  STALE_TIME_PROPERTIES_MS,
  STALE_TIME_PROPERTY_OPTIONS_MS,
  STALE_TIME_STATEMENT_MS
} from "../../lib/queryClient";
import type {
  DashboardSummaryParams,
  FinancialsDirectoryParams,
  InvoicesDirectoryParams,
  InvoiceDirectoryFilterParams,
  LeasesDirectoryParams,
  PropertiesDirectoryParams,
  TenantsDirectoryParams
} from "../../lib/queryKeys";
import { queryKeys } from "../../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";

export function useSettingsQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.settings(workspaceId) : ["settings", "anonymous"],
    queryFn: getOrCreateUserSettings,
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_METADATA_MS,
    gcTime: GC_TIME_MS
  });
}

export function usePropertyOptionsQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.propertyOptions(workspaceId) : ["properties", "options", "anonymous"],
    queryFn: getPropertyOptions,
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_PROPERTY_OPTIONS_MS,
    gcTime: GC_TIME_MS
  });
}

export function usePropertiesQuery(month?: string | null) {
  const workspaceId = useWorkspaceId();
  const filters = { month: month ?? null };
  return useQuery({
    queryKey: workspaceId ? queryKeys.properties(workspaceId, filters) : ["properties", "anonymous"],
    queryFn: () => getProperties(month ? { month } : undefined),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function usePropertiesDirectoryQuery(params: PropertiesDirectoryParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.propertiesDirectory(workspaceId, params)
      : ["properties-directory", "anonymous", params],
    queryFn: () => getPropertiesDirectory(params),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useTenantsDirectoryQuery(params: TenantsDirectoryParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.tenantsDirectory(workspaceId, params) : ["tenants", "directory", "anonymous", params],
    queryFn: () => getTenantsDirectory(params),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useLeasesDirectoryQuery(params: LeasesDirectoryParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.leasesDirectory(workspaceId, params) : ["leases", "directory", "anonymous", params],
    queryFn: () => getLeasesDirectory(params),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useInvoiceMetricsQuery(filters: InvoiceDirectoryFilterParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.invoiceMetrics(workspaceId, filters)
      : ["invoice-metrics", "anonymous", filters],
    queryFn: () => getInvoiceDirectoryMetrics(filters),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS
  });
}

export function useInvoicesListQuery(params: InvoicesDirectoryParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.invoicesList(workspaceId, params)
      : ["invoices", "anonymous", params],
    queryFn: () => getInvoicesDirectoryList(params),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

/** @deprecated Use useInvoiceMetricsQuery + useInvoicesListQuery */
export function useInvoicesDirectoryQuery(params: InvoicesDirectoryParams = {}) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.invoicesDirectory(workspaceId, params)
      : ["invoices", "directory", "anonymous", params],
    queryFn: () =>
      Promise.all([getInvoicesDirectoryList(params), getInvoiceDirectoryMetrics(params)]).then(
        ([list, metrics]) => ({ ...list, metrics, properties: [] as Array<{ id: string; name: string }> })
      ),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useFinancialsDirectoryQuery(params: FinancialsDirectoryParams) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.financialsDirectory(workspaceId, params)
      : ["financials", "anonymous", params.month, params.propertyId ?? "ALL"],
    queryFn: () => getFinancialsDirectory(params),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_STATEMENT_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useDashboardSummaryQuery(params: DashboardSummaryParams, opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId
      ? queryKeys.dashboardSummary(workspaceId, params)
      : ["dashboard-summary", "anonymous", params],
    queryFn: () => getPortfolioDashboardSummary(params),
    enabled: Boolean(workspaceId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_DASHBOARD_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function useTenantsListQuery() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.tenants(workspaceId, { list: true }) : ["tenants", "list", "anonymous"],
    queryFn: () => getTenants().catch(() => []),
    enabled: Boolean(workspaceId),
    staleTime: STALE_TIME_DIRECTORY_MS,
    gcTime: GC_TIME_MS
  });
}

export function usePropertyQuery(
  propertyId: string | undefined,
  opts?: { includeInvoices?: boolean; enabled?: boolean }
) {
  const workspaceId = useWorkspaceId();
  const includeInvoices = opts?.includeInvoices !== false;
  const variant = includeInvoices ? "full" : "core";
  return useQuery({
    queryKey: propertyId ? queryKeys.property(propertyId, variant) : ["property", "anonymous"],
    queryFn: () => getProperty(propertyId!, { includeInvoices }),
    enabled: Boolean(workspaceId && propertyId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

/** True when loading and no cached data yet — use for skeletons only. */
export function isInitialQueryLoad(query: { isLoading: boolean; isFetching: boolean; data: unknown }): boolean {
  return query.isLoading && query.data === undefined;
}

/** True when refetching with stale cache visible — use for subtle refreshing UI. */
export function isQueryRefreshing(query: { isFetching: boolean; isLoading: boolean; data: unknown }): boolean {
  return query.isFetching && !query.isLoading && query.data !== undefined;
}

export function useInvalidateQueries() {
  return useQueryClient();
}
