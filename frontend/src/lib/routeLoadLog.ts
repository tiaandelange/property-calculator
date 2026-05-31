/** Safe client-side route/chunk logging — no auth tokens, keys, or tenant/financial data. */

import { isChunkLoadError } from "./chunkLoadError";
import { formatRouteErrorForDev, isQueryError, type RouteErrorContext } from "./routeErrorUtils";

type SafeError = {
  name?: string;
  message?: string;
};

function toSafeError(error: unknown): SafeError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

export function logRouteNavigation(path: string): void {
  if (import.meta.env.DEV) {
    console.info("[route] navigate", path);
  }
}

export function logLazyImportStart(label?: string): void {
  if (import.meta.env.DEV) {
    console.info("[route] lazy-import-start", label ?? "unknown");
  }
}

export function logLazyImportFailure(label: string | undefined, error: unknown): void {
  const safe = toSafeError(error);
  console.error(
    `[RouteError] route=${label ?? "unknown"} phase=lazy-import error=${safe.name ?? "Error"}: ${safe.message ?? "unknown"}`
  );
}

export function logRoutePrefetchFailure(target: string, path: string | undefined, error: unknown): void {
  if (!import.meta.env.DEV) return;
  console.warn("[route] prefetch-failure", { target, path, ...toSafeError(error) });
}

export function logQueryPrefetchFailure(key: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  console.warn("[route] query-prefetch-failure", key, toSafeError(error));
}

export function logRouteRenderError(context: RouteErrorContext): void {
  const { routeLabel, path, locationKey, error, componentStack } = context;
  const details = formatRouteErrorForDev(error);
  const route = routeLabel ?? "unknown";
  const routePath = path ?? "unknown";

  console.error(
    `[RouteError] route=${route} path=${routePath} error=${details.name}: ${details.message}`,
    {
      locationKey,
      isChunkLoad: details.isChunkLoad,
      isQueryError: details.isQueryError,
      timestamp: new Date().toISOString(),
      stack: details.stack,
      componentStack
    }
  );
}

export function logChunkLoadFailure(source: string, error: unknown): void {
  const safe = toSafeError(error);
  console.error(
    `[RouteError] route=unknown path=unknown phase=${source} isChunkLoad=true error=${safe.name ?? "Error"}: ${safe.message ?? "unknown"}`
  );
}
