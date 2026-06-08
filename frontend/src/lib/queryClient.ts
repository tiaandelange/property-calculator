import { QueryClient } from "@tanstack/react-query";
import { queryRetry } from "./queryErrors";

/** Stable app metadata: profile, settings — 10 minutes */
export const STALE_TIME_METADATA_MS = 10 * 60 * 1000;

/** Property lists — 3 minutes */
export const STALE_TIME_PROPERTIES_MS = 3 * 60 * 1000;

/** Lightweight property id/name options — 5 minutes */
export const STALE_TIME_PROPERTY_OPTIONS_MS = 5 * 60 * 1000;

/** Dashboard summaries — 60 seconds */
export const STALE_TIME_DASHBOARD_MS = 60 * 1000;

/** Directory lists (tenants, leases, invoices) — 45 seconds */
export const STALE_TIME_DIRECTORY_MS = 45 * 1000;

/** Statements / financials ledger — 30 seconds */
export const STALE_TIME_STATEMENT_MS = 30 * 1000;

/** Survive normal workspace navigation without instant garbage collection */
export const GC_TIME_MS = 15 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_DIRECTORY_MS,
      gcTime: GC_TIME_MS,
      refetchOnWindowFocus: true,
      retry: queryRetry
    }
  }
});
