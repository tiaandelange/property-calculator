/** GTM container ID from build-time env (see vite.config.ts index.html injection). */
export function getGtmId(): string | undefined {
  const id = import.meta.env.VITE_GTM_ID?.trim();
  return id || undefined;
}

/**
 * GTM is installed via the official snippets in index.html (head + body noscript).
 * Kept for backwards compatibility — no dynamic injection (avoids duplicate gtm.js).
 */
export function initGoogleTagManager(): void {
  // no-op: GTM loads from index.html
}
