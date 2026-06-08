import type { QueryClient } from "@tanstack/react-query";
import {
  getFinancialsDirectory,
  getInvoice,
  getInvoicesDirectoryList,
  getInvoiceDirectoryMetrics,
  getLeasesDirectory,
  getPortfolioDashboardSummary,
  getProperty,
  getPropertyStatement,
  getPropertyTenants,
  getPropertyOptions,
  getTenantsDirectory,
  listPropertyInvoices,
  listPropertyUnits
} from "../api/ownedProperties";
import { fetchMe } from "../api/user";
import { FINANCIALS_PAGE_SIZE, localCalendarMonth } from "../features/financials/financialDirectoryUtils";
import { getOrCreateUserSettings } from "../services/settingsSupabase";
import { queryKeys } from "../lib/queryKeys";
import {
  GC_TIME_MS,
  STALE_TIME_DASHBOARD_MS,
  STALE_TIME_DIRECTORY_MS,
  STALE_TIME_METADATA_MS,
  STALE_TIME_PROPERTIES_MS,
  STALE_TIME_PROPERTY_OPTIONS_MS,
  STALE_TIME_STATEMENT_MS
} from "./queryClient";
import { logQueryPrefetchFailure, logRoutePrefetchFailure } from "./routeLoadLog";

type RoutePrefetchTarget =
  | "dashboard"
  | "properties"
  | "tenants"
  | "leases"
  | "invoices"
  | "financials"
  | "settings"
  | "property-detail"
  | "invoice-detail";

const routeChunkLoaders: Record<RoutePrefetchTarget, () => Promise<unknown>> = {
  dashboard: () => import("../pages/OwnedPropertiesPortfolioDashboardPage"),
  properties: () => import("../pages/OwnedPropertiesMyPropertiesPage"),
  tenants: () => import("../pages/TenantsListPage"),
  leases: () => import("../pages/OwnedLeasesPage"),
  invoices: () => import("../pages/InvoicesListPage"),
  financials: () => import("../pages/FinancialsListPage"),
  settings: () => import("../pages/SettingsPage"),
  "property-detail": () => import("../pages/OwnedPropertyDetailPage"),
  "invoice-detail": () => import("../pages/InvoiceDetailPage")
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

/** Segments under /owned-properties that are list/form routes, not property detail. */
const OWNED_PROPERTIES_RESERVED = new Set([
  "dashboard",
  "my-properties",
  "new",
  "reports",
  "recurring-invoices",
  "metrics",
  "tenants",
  "leases",
  "financials",
  "invoices",
  "documents"
]);

const prefetchedChunks = new Set<string>();
const inflightPrefetches = new Map<string, Promise<unknown>>();

function safePrefetch(key: string, run: () => Promise<unknown>): void {
  if (inflightPrefetches.has(key)) return;
  const promise = run()
    .catch((error) => {
      if (key.startsWith("chunk:")) {
        const target = key.slice("chunk:".length);
        logRoutePrefetchFailure(target, undefined, error);
      } else {
        logQueryPrefetchFailure(key, error);
      }
    })
    .finally(() => {
      inflightPrefetches.delete(key);
    });
  inflightPrefetches.set(key, promise);
}

function prefetchQueryDeduped(
  queryClient: QueryClient,
  key: string,
  options: Parameters<QueryClient["prefetchQuery"]>[0]
): void {
  safePrefetch(key, () => queryClient.prefetchQuery(options));
}

export function routePrefetchTarget(path: string): RoutePrefetchTarget | null {
  // Exact sidebar destinations first.
  const exactHit = navTargetByPath.find((entry) => path === entry.prefix);
  if (exactHit) return exactHit.target;

  // Invoice detail (including /invoices/new) before /invoices list prefix match.
  if (/^\/invoices\/[^/]+$/.test(path) && path !== "/invoices/legacy") {
    return "invoice-detail";
  }

  const ownedMatch = /^\/owned-properties\/([^/]+)$/.exec(path);
  if (ownedMatch && !OWNED_PROPERTIES_RESERVED.has(ownedMatch[1])) {
    return "property-detail";
  }

  const prefixHit = navTargetByPath.find((entry) => path.startsWith(`${entry.prefix}/`));
  return prefixHit?.target ?? null;
}

/** Prefetch route chunk — never throws; failures are logged and do not block navigation. */
export function prefetchRouteChunk(target: RoutePrefetchTarget, path?: string): void {
  if (prefetchedChunks.has(target)) return;

  safePrefetch(`chunk:${target}`, async () => {
    try {
      await routeChunkLoaders[target]();
      prefetchedChunks.add(target);
    } catch (error) {
      logRoutePrefetchFailure(target, path, error);
    }
  });
}

/** Shared hover/focus/touch handlers for nav links — one prefetch burst per interaction type. */
export function navWarmHandlers(
  path: string,
  queryClient: QueryClient,
  workspaceId: string | null,
  authReady = false
): {
  onMouseEnter: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
} {
  const warm = () => prefetchWorkspaceRoute(path, queryClient, workspaceId, authReady);
  return {
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm
  };
}

export function prefetchWorkspaceRoute(
  path: string,
  queryClient: QueryClient,
  workspaceId: string | null,
  authReady = false
): void {
  const target = routePrefetchTarget(path);
  if (!target) return;
  prefetchRouteChunk(target, path);
  if (!workspaceId || !authReady) return;

  switch (target) {
    case "dashboard":
      prefetchQueryDeduped(queryClient, `dashboard:${workspaceId}`, {
        queryKey: queryKeys.dashboardSummary(workspaceId, { month: localCalendarMonth(), propertyId: null }),
        queryFn: () => getPortfolioDashboardSummary({ month: localCalendarMonth(), propertyId: null }),
        staleTime: STALE_TIME_DASHBOARD_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "properties":
      prefetchQueryDeduped(queryClient, `property-options:${workspaceId}`, {
        queryKey: queryKeys.propertyOptions(workspaceId),
        queryFn: getPropertyOptions,
        staleTime: STALE_TIME_PROPERTY_OPTIONS_MS,
        gcTime: GC_TIME_MS
      });
      prefetchQueryDeduped(queryClient, `properties:${workspaceId}`, {
        queryKey: queryKeys.properties(workspaceId, {}),
        queryFn: () => import("../api/ownedProperties").then((m) => m.getProperties()),
        staleTime: STALE_TIME_PROPERTIES_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "tenants":
      prefetchQueryDeduped(queryClient, `tenants-directory:${workspaceId}`, {
        queryKey: queryKeys.tenantsDirectory(workspaceId, { page: 1, pageSize: 6, tab: "tenants" }),
        queryFn: () => getTenantsDirectory({ page: 1, pageSize: 6, tab: "tenants" }),
        staleTime: STALE_TIME_DIRECTORY_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "leases":
      prefetchQueryDeduped(queryClient, `leases-directory:${workspaceId}`, {
        queryKey: queryKeys.leasesDirectory(workspaceId, { page: 1, pageSize: 6 }),
        queryFn: () => getLeasesDirectory({ page: 1, pageSize: 6 }),
        staleTime: STALE_TIME_DIRECTORY_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "invoices":
      prefetchQueryDeduped(queryClient, `invoice-metrics:${workspaceId}`, {
        queryKey: queryKeys.invoiceMetrics(workspaceId, {}),
        queryFn: () => getInvoiceDirectoryMetrics({}),
        staleTime: STALE_TIME_DIRECTORY_MS,
        gcTime: GC_TIME_MS
      });
      prefetchQueryDeduped(queryClient, `invoices-list:${workspaceId}`, {
        queryKey: queryKeys.invoicesList(workspaceId, { page: 1, pageSize: 20 }),
        queryFn: () => getInvoicesDirectoryList({ page: 1, pageSize: 20 }),
        staleTime: STALE_TIME_DIRECTORY_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "financials":
      prefetchQueryDeduped(queryClient, `financials-directory:${workspaceId}`, {
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
        staleTime: STALE_TIME_STATEMENT_MS,
        gcTime: GC_TIME_MS
      });
      break;
    case "settings":
      prefetchAuthWorkspace(queryClient, workspaceId);
      break;
    default:
      break;
  }
}

/** After sign-in: warm settings + profile (respects stale cache; invalidation still refetches). */
export function prefetchAuthWorkspace(
  queryClient: QueryClient,
  workspaceId: string,
  authReady = true
): void {
  if (!authReady || !workspaceId) return;
  prefetchQueryDeduped(queryClient, `settings:${workspaceId}`, {
    queryKey: queryKeys.settings(workspaceId),
    queryFn: getOrCreateUserSettings,
    staleTime: STALE_TIME_METADATA_MS,
    gcTime: GC_TIME_MS
  });
  prefetchQueryDeduped(queryClient, `profile:${workspaceId}`, {
    queryKey: queryKeys.profile(workspaceId),
    queryFn: fetchMe,
    staleTime: STALE_TIME_METADATA_MS,
    gcTime: GC_TIME_MS
  });
}

/** Property list/card hover — core property, units, dashboard summary only (no statement ledger). */
export function prefetchPropertyFromList(
  propertyId: string,
  queryClient: QueryClient,
  workspaceId: string | null,
  summaryMonth = localCalendarMonth(),
  authReady = false
): void {
  prefetchRouteChunk("property-detail");
  if (!workspaceId || !propertyId || !authReady) return;

  prefetchQueryDeduped(queryClient, `property:core:${propertyId}`, {
    queryKey: queryKeys.property(propertyId, "core"),
    queryFn: () => getProperty(propertyId, { includeInvoices: false }),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS
  });
  prefetchQueryDeduped(queryClient, `property-units:${propertyId}`, {
    queryKey: queryKeys.propertyUnits(propertyId),
    queryFn: () => listPropertyUnits(propertyId),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS
  });
  prefetchQueryDeduped(queryClient, `property-dashboard:${propertyId}:${summaryMonth}`, {
    queryKey: queryKeys.dashboardSummary(workspaceId, { propertyId, month: summaryMonth }),
    queryFn: () => getPortfolioDashboardSummary({ propertyId, month: summaryMonth }),
    staleTime: STALE_TIME_DASHBOARD_MS,
    gcTime: GC_TIME_MS
  });
}

/** Background tab warm after property detail core is ready — skips keys already loading for active tab. */
export function prefetchPropertyWorkspaceTabs(opts: {
  propertyId: string;
  workspaceId: string;
  queryClient: QueryClient;
  summaryMonth: string;
  activeTab: string;
}): void {
  const { propertyId, workspaceId, queryClient, summaryMonth, activeTab } = opts;
  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? (fn: () => void) => requestIdleCallback(fn, { timeout: 2000 })
      : (fn: () => void) => window.setTimeout(fn, 150);

  schedule(() => {
    if (activeTab !== "tenants" && activeTab !== "leases") {
      prefetchQueryDeduped(queryClient, `property-tenants:${propertyId}`, {
        queryKey: queryKeys.propertyTenants(propertyId),
        queryFn: () => getPropertyTenants(propertyId),
        staleTime: STALE_TIME_PROPERTIES_MS,
        gcTime: GC_TIME_MS
      });
    }

    if (activeTab !== "overview" && activeTab !== "financials") {
      prefetchQueryDeduped(queryClient, `property-statement:${propertyId}:${summaryMonth}`, {
        queryKey: queryKeys.propertyStatement(propertyId, { month: summaryMonth, includeExpected: true }),
        queryFn: () => getPropertyStatement(propertyId, { month: summaryMonth, includeExpected: true }),
        staleTime: STALE_TIME_STATEMENT_MS,
        gcTime: GC_TIME_MS
      });
    }

    if (activeTab !== "overview") {
      prefetchQueryDeduped(queryClient, `property-dashboard:${propertyId}:${summaryMonth}`, {
        queryKey: queryKeys.dashboardSummary(workspaceId, { propertyId, month: summaryMonth }),
        queryFn: () => getPortfolioDashboardSummary({ propertyId, month: summaryMonth }),
        staleTime: STALE_TIME_DASHBOARD_MS,
        gcTime: GC_TIME_MS
      });
    }

    if (activeTab !== "financials") {
      prefetchQueryDeduped(queryClient, `property-invoices:${propertyId}`, {
        queryKey: queryKeys.propertyInvoices(propertyId),
        queryFn: () =>
          listPropertyInvoices(propertyId, {
            includeLineItems: true,
            attachDownloadUrls: false
          }),
        staleTime: STALE_TIME_STATEMENT_MS,
        gcTime: GC_TIME_MS
      });
    }
  });
}

/** Invoice row hover — detail route + invoice record only (no PDF generation). */
export function prefetchInvoiceDetail(
  invoiceId: string,
  queryClient: QueryClient,
  workspaceId: string | null,
  authReady = false
): void {
  if (!invoiceId || invoiceId === "new") return;
  prefetchRouteChunk("invoice-detail");
  if (!workspaceId || !authReady) return;
  prefetchQueryDeduped(queryClient, `invoice:${invoiceId}`, {
    queryKey: queryKeys.invoiceDetail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
    staleTime: STALE_TIME_PROPERTIES_MS,
    gcTime: GC_TIME_MS
  });
}

/** @deprecated Use prefetchPropertyFromList */
export function prefetchPropertyDetail(propertyId: string, queryClient: QueryClient, workspaceId: string | null): void {
  prefetchPropertyFromList(propertyId, queryClient, workspaceId);
}

export function listWarmHandlers(
  warm: () => void
): {
  onMouseEnter: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
} {
  return {
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm
  };
}
