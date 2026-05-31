import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { clearChunkReloadFlag, isChunkLoadError } from "./chunkLoadError";
import { logLazyImportFailure, logLazyImportStart } from "./routeLoadLog";

export type LazyWithRetryOptions = {
  /** Human-readable route label for dev logging only. */
  label?: string;
  /** Total import attempts (default 3). Chunk-load errors retry with backoff. */
  retries?: number;
};

/**
 * Safe lazy route helper — wraps React.lazy with chunk-load detection, retries,
 * and structured logging. Failures propagate to RouteErrorBoundary (no infinite reload).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  options: LazyWithRetryOptions = {}
): LazyExoticComponent<T> {
  const { label, retries = 3 } = options;

  return lazy(async () => {
    logLazyImportStart(label);
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const module = await factory();
        clearChunkReloadFlag();
        return module;
      } catch (error) {
        lastError = error;
        logLazyImportFailure(label, error);

        const shouldRetry = attempt < retries - 1 && (isChunkLoadError(error) || attempt === 0);
        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to load page.");
  });
}

/** Alias for lazyWithRetry — same safe dynamic import wrapper. */
export const safeLazy = lazyWithRetry;
