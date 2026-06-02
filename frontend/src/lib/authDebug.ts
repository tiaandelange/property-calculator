/** Dev-only auth diagnostics (never log tokens or PII). */
export function logAuthEvent(event: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[Auth]", event, detail ?? "");
}

export function logAuthSignOut(source: string, reason?: string): void {
  if (!import.meta.env.DEV) return;
  console.warn(`[Auth] signOut called from: ${source}`, reason ? { reason } : "");
}

export function logProtectedRoute(
  decision: "loading" | "allow" | "redirect",
  detail: Record<string, unknown>
): void {
  if (!import.meta.env.DEV) return;
  console.info(`[Auth] RequireAuth → ${decision}`, detail);
}

export function logReportsQuery(status: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info(`[Auth] Reports page → ${status}`, detail ?? "");
}
