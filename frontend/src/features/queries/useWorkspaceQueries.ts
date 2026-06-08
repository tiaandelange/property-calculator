import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getPropertyStatement,
  getPropertyStatementRange,
  getPropertyTenants,
  getPropertyWorkspaceReports,
  getTenant,
  listPropertyInvoices
} from "../../api/ownedProperties";
import { fetchMe } from "../../api/user";
import { getWorkspaceNotifications } from "../../services/workspaceNotificationsSupabase";
import {
  GC_TIME_MS,
  STALE_TIME_METADATA_MS,
  STALE_TIME_PROPERTIES_MS,
  STALE_TIME_STATEMENT_MS
} from "../../lib/queryClient";
import type { PropertyStatementParams, PropertyStatementRangeParams } from "../../lib/queryKeys";
import { queryKeys } from "../../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";

export function usePropertyInvoicesQuery(propertyId: string | undefined, opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: propertyId ? queryKeys.propertyInvoices(propertyId) : ["property", "invoices", "anonymous"],
    queryFn: () =>
      listPropertyInvoices(propertyId!, {
        includeLineItems: true,
        attachDownloadUrls: false
      }),
    enabled: Boolean(workspaceId && propertyId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_STATEMENT_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function usePropertyTenantsQuery(propertyId: string | undefined, opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: propertyId ? queryKeys.propertyTenants(propertyId) : ["property", "tenants", "anonymous"],
    queryFn: () => getPropertyTenants(propertyId!),
    enabled: Boolean(workspaceId && propertyId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function usePropertyStatementQuery(
  propertyId: string | undefined,
  params: PropertyStatementParams,
  opts?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: propertyId
      ? queryKeys.propertyStatement(propertyId, params)
      : ["property-statement", "anonymous"],
    queryFn: () =>
      getPropertyStatement(propertyId!, {
        month: params.month,
        includeExpected: params.includeExpected
      }),
    enabled: Boolean(workspaceId && propertyId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_STATEMENT_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function usePropertyStatementRangeQuery(
  propertyId: string | undefined,
  params: PropertyStatementRangeParams,
  opts?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: propertyId
      ? queryKeys.propertyStatementRange(propertyId, params)
      : ["property-statement-range", "anonymous"],
    queryFn: () =>
      getPropertyStatementRange(propertyId!, {
        startDate: params.startDate,
        endDate: params.endDate,
        includeExpected: params.includeExpected
      }),
    enabled:
      Boolean(workspaceId && propertyId && params.startDate && params.endDate) &&
      (opts?.enabled !== false),
    staleTime: STALE_TIME_STATEMENT_MS,
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData
  });
}

export function usePropertyReportsQuery(propertyId: string | undefined, opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: propertyId ? queryKeys.propertyReports(propertyId) : ["property", "reports", "anonymous"],
    queryFn: () => getPropertyWorkspaceReports(propertyId!),
    enabled: Boolean(workspaceId && propertyId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS
  });
}

export function useTenantQuery(tenantId: string | undefined, opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: tenantId ? queryKeys.tenant(tenantId) : ["tenant", "anonymous"],
    queryFn: () => getTenant(tenantId!),
    enabled: Boolean(workspaceId && tenantId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS
  });
}

export function useProfileQuery(opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.profile(workspaceId) : ["profile", "anonymous"],
    queryFn: fetchMe,
    enabled: Boolean(workspaceId) && (opts?.enabled !== false),
    staleTime: STALE_TIME_METADATA_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false
  });
}

export function useWorkspaceNotificationsQuery(opts?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: workspaceId ? queryKeys.workspaceNotifications(workspaceId) : ["workspace-notifications", "anonymous"],
    queryFn: getWorkspaceNotifications,
    enabled: Boolean(workspaceId) && (opts?.enabled !== false),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    gcTime: GC_TIME_MS
  });
}
