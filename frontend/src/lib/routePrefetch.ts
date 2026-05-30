import type { QueryClient } from "@tanstack/react-query";
import { getFinancialsDirectory, getInvoicesDirectory, getLeasesDirectory, getPropertyOptions, getTenantsDirectory } from "../api/ownedProperties";
import { FINANCIALS_PAGE_SIZE, localCalendarMonth } from "../features/financials/financialDirectoryUtils";
import { queryKeys } from "../lib/queryKeys";
import { STALE_TIME_DIRECTORY_MS, STALE_TIME_PROPERTY_OPTIONS_MS, STALE_TIME_PROPERTIES_MS, STALE_TIME_STATEMENT_MS } from "./queryClient";

type RoutePrefetchTarget =
  | "dashboard"
  | "properties"
  | "tenants"
  | "leases"
  | "invoices"
  | "financials"
  | "settings"
  | "property-detail";

const routeChunkLoaders: Record<RoutePrefetchTarget, () => Promise<unknown>> = {
  dashboard: () => import("../pages/OwnedPropertiesPortfolioDashboardPage"),
  properties: () => import("../pages/OwnedPropertiesMyPropertiesPage"),
  tenants: () => import("../pages/TenantsListPage"),
  leases: () => import("../pages/OwnedLeasesPage"),
  invoices: () => import("../pages/InvoicesListPage"),
  financials: () => import("../pages/FinancialsListPage"),
  settings: () => import("../pages/SettingsPage"),
  "property-detail": () => import("../pages/OwnedPropertyDetailPage")
};

const navTargetByPath: Array<{ prefix: string; target: RoutePrefetchTarget }> = [
  { prefix: "/owned-properties/dashboard", target: "dashboard" },
  { prefix: "/dashboard", target: "dashboard" },
  { prefix: "/owned-properties/my-properties", target: "properties" },
  { prefix: "/tenants", target: "tenants" },
  { prefix: "/leases", target: "leases" },
  { prefix: "/invoices", target: "invoices" },
  { prefix: "/financials", target: "financials" },
  { prefix: "/settings", target: "settings" }
];

export function routePrefetchTarget(path: string): RoutePrefetchTarget | null {
  if (/^\/owned-properties\/[^/]+$/.test(path) && !path.includes("dashboard") && !path.includes("reports")) {
    return "property-detail";
  }
  const hit = navTargetByPath.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`));
  return hit?.target ?? null;
}

const prefetchedChunks = new Set<string>();

export function prefetchRouteChunk(target: RoutePrefetchTarget): void {
  if (prefetchedChunks.has(target)) return;
  prefetchedChunks.add(target);
  void routeChunkLoaders[target]();
}

export function prefetchWorkspaceRoute(path: string, queryClient: QueryClient, workspaceId: string | null): void {
  const target = routePrefetchTarget(path);
  if (!target) return;
  prefetchRouteChunk(target);
  if (!workspaceId) return;

  switch (target) {
    case "properties":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.propertyOptions(workspaceId),
        queryFn: getPropertyOptions,
        staleTime: STALE_TIME_PROPERTY_OPTIONS_MS
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.properties(workspaceId, {}),
        queryFn: () => import("../api/ownedProperties").then((m) => m.getProperties()),
        staleTime: STALE_TIME_PROPERTIES_MS
      });
      break;
    case "tenants":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.tenantsDirectory(workspaceId, { page: 1, pageSize: 6, tab: "tenants" }),
        queryFn: () => getTenantsDirectory({ page: 1, pageSize: 6, tab: "tenants" }),
        staleTime: STALE_TIME_DIRECTORY_MS
      });
      break;
    case "leases":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.leasesDirectory(workspaceId, { page: 1, pageSize: 6 }),
        queryFn: () => getLeasesDirectory({ page: 1, pageSize: 6 }),
        staleTime: STALE_TIME_DIRECTORY_MS
      });
      break;
    case "invoices":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.invoicesDirectory(workspaceId, { page: 1, pageSize: 20 }),
        queryFn: () => getInvoicesDirectory({ page: 1, pageSize: 20 }),
        staleTime: STALE_TIME_DIRECTORY_MS
      });
      break;
    case "financials":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.financialsDirectory(workspaceId, {
          month: localCalendarMonth(),
          propertyId: null,
          page: 1,
          pageSize: FINANCIALS_PAGE_SIZE,
          q: "",
          source: "ALL"
        }),
        queryFn: () =>
          getFinancialsDirectory({
            month: localCalendarMonth(),
            propertyId: null,
            page: 1,
            pageSize: FINANCIALS_PAGE_SIZE
          }),
        staleTime: STALE_TIME_STATEMENT_MS
      });
      break;
    case "settings":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.settings(workspaceId),
        queryFn: () => import("../services/settingsSupabase").then((m) => m.getOrCreateUserSettings()),
        staleTime: STALE_TIME_PROPERTY_OPTIONS_MS
      });
      break;
    default:
      break;
  }
}

export function prefetchPropertyDetail(propertyId: string, queryClient: QueryClient, workspaceId: string | null): void {
  prefetchRouteChunk("property-detail");
  if (!workspaceId || !propertyId) return;
  void queryClient.prefetchQuery({
    queryKey: queryKeys.property(propertyId, "core"),
    queryFn: () => import("../api/ownedProperties").then((m) => m.getProperty(propertyId, { includeInvoices: false })),
    staleTime: STALE_TIME_PROPERTIES_MS
  });
}
