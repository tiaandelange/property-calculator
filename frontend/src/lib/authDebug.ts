/** Dev-only auth diagnostics (never log tokens or PII). */
function route(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

function stamp(): string {
  return new Date().toISOString();
}

export function logAuthEvent(event: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[AuthEvent]", event, { ...detail, route: route(), at: stamp() });
}

export function logAuthState(detail: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[AuthState]", { ...detail, route: route(), at: stamp() });
}

export function logAuthSignOut(source: string, reason?: string): void {
  if (!import.meta.env.DEV) return;
  console.warn("[Auth] signOut called", {
    source,
    reason,
    route: route(),
    at: stamp()
  });
}

export function logProtectedRoute(
  decision: "loading" | "allow" | "redirect",
  detail: Record<string, unknown>
): void {
  if (!import.meta.env.DEV) return;
  console.info("[AuthGuard]", decision, { ...detail, route: route(), at: stamp() });
}

export function logSignInFlow(step: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[Auth] sign-in", step, { ...detail, route: route(), at: stamp() });
}

export function logReportsQuery(status: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info(`[Auth] Reports page → ${status}`, detail ?? "");
}
