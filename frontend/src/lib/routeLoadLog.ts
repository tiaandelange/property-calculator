/** Safe client-side route/chunk logging — no auth tokens, keys, or tenant/financial data. */

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
  console.error("[route] lazy-import-failure", label ?? "unknown", toSafeError(error));
}

export function logRoutePrefetchFailure(target: string, path: string | undefined, error: unknown): void {
  console.error("[route] prefetch-failure", { target, path, ...toSafeError(error) });
}

export function logQueryPrefetchFailure(key: string, error: unknown): void {
  console.error("[route] query-prefetch-failure", key, toSafeError(error));
}

export function logRouteRenderError(error: unknown, info?: string): void {
  console.error("[route] render-error", toSafeError(error), info ?? "");
}

export function logChunkLoadFailure(source: string, error: unknown): void {
  console.error("[route] chunk-load-failure", source, toSafeError(error));
}
