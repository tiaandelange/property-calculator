/** Session flag — set before a single reload attempt to avoid reload loops after deploy. */
export const CHUNK_RELOAD_KEY = "pg-chunk-reload";

const CHUNK_ERROR_PATTERNS = [
  "ChunkLoadError",
  "Loading chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "Failed to load module script",
  "dynamically imported module"
] as const;

/** True when a dynamic import / Vite chunk failed to load (often stale hash after deploy). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "ChunkLoadError") return true;
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function markChunkReloadAttempted(): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    /* ignore storage errors */
  }
}

export function hasChunkReloadBeenAttempted(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
