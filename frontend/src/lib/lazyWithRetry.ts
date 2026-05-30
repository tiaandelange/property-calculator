import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RELOAD_KEY = "pg-chunk-reload";

/**
 * Retry lazy route imports — recovers from transient network errors and stale
 * chunk hashes after deploy (common cause of blank pages until hard refresh).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 3
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const module = await factory();
        try {
          sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        } catch {
          /* ignore */
        }
        return module;
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
      }
    }

    try {
      const reloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
      if (!reloaded) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        await new Promise(() => {
          /* wait for reload */
        });
      }
    } catch {
      /* ignore storage errors */
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to load page.");
  });
}
